<?php
/*
	Прокси, обеспечивающий работу демо-приложения demoSavingsCalc.
		
	Пример запроса к источнику.
	
		http://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=02/03/2001&date_req2=14/03/2001&VAL_NM_RQ=R01235

	Примечания.
	
		Источник предлагает обращаться за кодами валют сюда: http://www.cbr.ru/scripts/XML_val.asp?d=0
		Однако там отсутствуют буквенные коды ISO 4217.
		В то же время они есть в ежедневном отчёте: http://www.cbr.ru/scripts/XML_daily_eng.asp
		Поэтому перед запросом под диапазону, мы обращаемся к нему, чтобы вытащить соответствия кодов и построить запросы.
		Прокси получает данные от источника и хранит в sqlite-базе.
		Если дата окончания периода (т.е. в приложение дата "СЕГОДНЯ") больше чем та, на которую сохранены данные, заново запрашивается целый год. Так сделано для упрощения кода для демоверсии.
		Все курсы хранятся относительно рубля, поэтому при выборе в приложении другой валюты,  в запросе будет другая базовая валюта, поэтому будет остуществлён пересчёт по рублю.
		Прокси практически не защищен от некорректного GET-запроса, ошибок БД и ошибок сервиса источника. Сделано опять-таки для упрощения.
		

	Пример запроса к этому прокси.
	
		/?to=2016-01-19&c=EUR;USD&b=RUB
	
	Пример ответа этого прокси. 

		{
			"USD": [
				{"dt": "2016-01-19", "val": 75.0000}
			],
			"EUR": [
				{"dt": "2016-01-19", "val": 85.0000}
			]				
		}	


*/


file_put_contents("log", time() . "\t" . $_SERVER['REQUEST_URI'] . "\n", FILE_APPEND);

// обработка параметров
$currencies = explode(';', $_REQUEST['c']);	// какие валюты запрошены
$currencyBase = $_REQUEST['b'];	// какая - базовая
$dtTo = $_REQUEST['to']; // только конец диапазона, потому что вынимаем всегда на год назад

// если базовая не рубль, мы её принудительно включим в перечень запрошенных, если её там нет, чтобы данные по ней вытащить из источника и/или базы
if ($currencyBase != 'RUB'){
	if (array_search($currencyBase, $currencies) === false){
		$currencies[] = $currencyBase;
	}
}

// инициализация базы
$db = new SQLite3('rates.db');
initDB($db);

// обновляем базу по запрошенному перечню и дате конца периода
updateDB($db, $currencies, $dtTo);

// готовим ответ, обращаясь уже к базе
// здесь будем вынимать данные, заполнять пустые даты, приводить курсы к базовой валюте, пересчитывая по рублю
$res['data'] = prepareResponse($db, $currencies, $currencyBase, $dtTo);

// отправляем приложению
header('Access-Control-Allow-Origin: *');  
header('Content-type: application/json');	
echo(json_encode($res));


// ------------------------------------------------

// готовим данные
function prepareResponse($db, $currencies, $currencyBase, $dtTo){
	
	$res = array();

	// для каждой валюты в запросе			
	foreach ($currencies as $currency){
		
		if ($currency == 'RUB'){continue;} // по рублю не запрашиваем, т.к. это базовая валюта хранения
		
		$dtEnd = new DateTime($dtTo);
		$dtStart = (new DateTime($dtTo))->sub(new DateInterval('P1Y'));		

		// поскольку в базе представлены не сплошные диапазоны, выбираем максимальную дату, меньшую нашего "начала года" и будем использовать её данные к отправные для "экстраполяции"
		$result = $db->query("SELECT MAX(`dt`) AS dtMaxBeforeStart FROM `rates` WHERE `c` = '{$currency}' AND `dt` <= '" . $dtStart->format('Y-m-d') . "'");
		$array = $result->fetcharray(SQLITE3_ASSOC);
		$dtMaxBeforeStart = $array['dtMaxBeforeStart'];
		
		// теперь запрашиваем данные за период от dtMaxBeforeStart до dtEnd
		$result = $db->query("SELECT `dt`, `v` FROM `rates` WHERE `c` = '{$currency}' AND `dt` >= '{$dtMaxBeforeStart}' AND `dt` <= '" . $dtEnd->format('Y-m-d') . "'");
		$rates = array();
		while ($array = $result->fetcharray(SQLITE3_ASSOC)){
			$rates[$array['dt']] = $array['v']; 
		}
		
		// теперь "корректируем" диапазон, заполняя пустые даты
		$dtMaxBeforeStart = new DateTime($dtMaxBeforeStart);
		$repeat = true; 
		$stop = $dtEnd->format('Y-m-d');
		
		while ($repeat){
			$prevDt = $dtMaxBeforeStart->format('Y-m-d');
			$dtMaxBeforeStart->add(new DateInterval('P1D'));
			$currDt = $dtMaxBeforeStart->format('Y-m-d');
			if (empty($rates[$currDt])){
				$rates[$currDt] = $rates[$prevDt]; 
				// вот здесь обновляем БД, потому что иначе по дням, когда нет курса, прокси постоянно будет обращаться к источнику
				// ???
			}
			$repeat = ($currDt == $stop) ? false : true;
		}

		// перебирая даты с начала до конца за годовой период формируем упорядоченный по возрастанию массив
		$res[$currency] = array();
		$repeat = true; 
		$stop = $dtEnd->format('Y-m-d');
				
		while ($repeat){
			$k = $dtStart->format('Y-m-d');
			$res[$currency][] = array('dt' => $k, 'val' => $rates[$k]);  
			$dtStart->add(new DateInterval('P1D'));
			$repeat = ($k == $stop) ? false : true;
		}		
		
	}
	
	// наконец, выполняем приведение к базовой валюте, если это не RUB, внедрение массива RUB и удаление массива той валюты, к которой приводим
	if ($currencyBase != 'RUB'){
		
		$r = array_search('RUB', $currencies); // если в число запрошенных был включён RUB
		if ($r !== false){$res['RUB'] = array();}

		$dtEnd = new DateTime($dtTo);
		$dtStart = (new DateTime($dtTo))->sub(new DateInterval('P1Y'));
		$repeat = true;
		$stop = $dtEnd->format('Y-m-d');
		
		$index = -1;
		while ($repeat){
			$k = $dtStart->format('Y-m-d');
			
			if ($r !== false){
				$res['RUB'][] = array('dt' => $k, 'val' => 1);
			}    
			
			$index++;
			foreach ($currencies as $currency){
				// приводим к базовой
				if ($currency != $currencyBase) {	// саму на себя не делим
					$res[$currency][$index]['val'] = round($res[$currency][$index]['val'] / $res[$currencyBase][$index]['val'], 4);
				} 
			}
			$dtStart->add(new DateInterval('P1D'));
			$repeat = ($k == $stop ) ? false : true;
		}
		
		unset($res[$currencyBase]);
	}
	
	return $res;

}



// обновляем курсы в базе, если окажется нобходимо
function updateDB($db, $currencies, $dtTo){
	
	// массив кодов валют, которые будем запрашивать
	$toRecieve = array();

	// проверка, что есть по запросу уже в базе и запрос новых данных из источника
	foreach ($currencies as $currency){
		if ($currency == 'RUB'){continue;} // по рублю не запрашиваем, т.к. это базовая валюта хранения
		
		$result = $db->query("SELECT MAX(`dt`) AS dtMax FROM `rates` WHERE `c` = '{$currency}' ");
		
		while ($array = $result->fetcharray(SQLITE3_ASSOC)){
			if ($array['dtMax'] < $dtTo){
				$toRecieve[] = $currency;
			}
		}	
	}	
	

	// есть что запрашивать?
	
	if (count($toRecieve)){
		// запросим коды
		$codes = getCodes();

		// теперь запросим и положим в базу все валюты
		foreach ($toRecieve as $currency){
			$rates = getData($dtTo, $codes[$currency]);
			// вносим в базу
			$queries = array();
			$queries[] = 'BEGIN'; // ускорить вставку нескольких сотен записей
			foreach ($rates as $k => $v){
				$queries[] = "INSERT OR IGNORE INTO `rates` (`dt`, `c`, `v`) VALUES ('$k', '{$currency}', '{$v}')"; 
			}
			$queries[] = 'COMMIT';
			
	
			$db->query(implode(";",$queries));
			
		}	
	}	
	
}


// получаем данные за год
function getData($dtTo, $currencyCode){
	
	// что за дата будет год назад?
	$dtEnd = new DateTime($dtTo);
	$dtStart = (new DateTime($dtTo))->sub(new DateInterval('P1Y'));

	
	// поскольку в источнике нет данных по выходным дням и праздниам и мы будем "экстраполировать", возьмём запас в 15 дней до полученного "начала периода".
	$dtStart->sub(new DateInterval('P15D'));
	
	$rates = array();

	$req = "http://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=" . $dtStart->format('d/m/Y') . "&date_req2=" . $dtEnd->format('d/m/Y') . "&VAL_NM_RQ=" . $currencyCode;	
	
	file_put_contents("log", time() . "\t" . $req ."\n", FILE_APPEND);
	
	$ch = curl_init($req);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HEADER, 0);
	$data = curl_exec($ch);
	curl_close($ch);
	
	if (!empty($data)){
		$xml = new SimpleXmlElement($data, LIBXML_NOCDATA);
		if (isset($xml->Record)){
			$cnt = count($xml->Record);
			for($i=0; $i<$cnt; $i++){
				$dt = explode('.',((string)$xml->Record[$i]->attributes()['Date']));
				$val = (float)str_replace(',','.',(string)$xml->Record[$i]->Value) / (float)(string)$xml->Record[$i]->Nominal;
				$rates[$dt[2] . '-' . $dt[1] . '-' . $dt[0]] = $val;
			}
		}
	}
	

	
	return $rates;
}


// получаем коды валют от источника
function getCodes(){

	$codes = array();
	
	$ch = curl_init("http://www.cbr.ru/scripts/XML_daily_eng.asp");
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HEADER, 0);
	$data = curl_exec($ch);
	curl_close($ch);
	
	if (!empty($data)){
		$xml = new SimpleXmlElement($data, LIBXML_NOCDATA);
		if (isset($xml->Valute)){
			$cnt = count($xml->Valute);
			for($i=0; $i<$cnt; $i++){
				$codes[(string)$xml->Valute[$i]->CharCode] = (string)$xml->Valute[$i]->attributes()['ID'];
			}
		}
	}
	
	return $codes;		
} 


function initDB($db){
	$db->query("CREATE TABLE IF NOT EXISTS `rates` (
			`dt` DATE,
			`c` CHAR(3),
			`v` DOUBLE,
			PRIMARY KEY (`dt`, `c`)
		)");
}

