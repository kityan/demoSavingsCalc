myApp.factory('Calc', ['Config', '$window', '$base64', function(Config, $window, $base64) {

	var Service = {};
	
	// флаг импорта, чтобы не сохранять объект 
	var imported = false;
	
	var todayRates = {}; // объект с кросс-курсами, не хранится
	
	var storage = 	$window.localStorage;
	
	var storedCalcData = storage.getItem('calc');
	
	var calcData = (storedCalcData) ? JSON.parse(storedCalcData) : {
			selectedCurrenciesCodes: Config.defaultSelectedCurrenciesCodes, // отобранные валюты
			baseCurrencyCode: Config.defaultBaseCurrencyCode, // базовая валюта
			predictions: {}, // объект в котором ключи - коды валют в качестве базовой), а значения - объекты. В них ключи - коды остальных валют, а значения - объекты массив (индексы от 0 до 3: через 3 мес, 6 мес, 9 мес, год), значения - прогноз курса по данным пользователя
			accounts: {}, // объект в котором ключи - коды валют, а значения - средства в этой валюте
			interests:  Config.defaultInterests, // объект в котором ключи - коды валют, а значения - процент
			withInterests: false 
	}
	
	function save(){
		if (!imported){
			storage.setItem('calc', JSON.stringify(calcData));
		}
	}
	
	Service.saveImported = function(){
		imported = false;
		save();
	}	

	// импортируем
	Service.import = function(str){
		imported = true;
		calcData = JSON.parse($base64.decode(str.replace(/;/g,'=')));
	}	

	// экспортируем
	Service.getExportString = function(str){
		return $base64.encode(JSON.stringify(calcData)).replace(/=/g,';');
	}	

	// возвращаем код текущей базовой валюты
	Service.getBaseCurrencyCode = function(){
		return calcData.baseCurrencyCode;
	}
	
	// сохраняем код текущей базовой валюты и возвращаем пересортировку
	Service.setBaseCurrencyCode = function(baseCurrencyCode){
		calcData.baseCurrencyCode = baseCurrencyCode;
		save();
		return this.getSelectedCurrencies();
	}	

	// сохраняем новое значение счёта валюты и пересчитываем конвертацию
	Service.setAccount = function(code, value, selectedCurrencies){
		calcData.accounts[code] = parseFloat(value);
		for (var index in selectedCurrencies){
			if (selectedCurrencies[index].code == code){
				selectedCurrencies[index].converted = getConverted(code);
			}
		}
		save();
	}	
	
	// сохраняем новое значение счёта валюты 
	Service.setInterest = function(code, value){
		calcData.interests[code] = parseFloat(value);
		save();
	}	
	

 	// сохраняем обновлённый перечень валют
	Service.setSelectedCurrenciesCodes = function(selectedCurrenciesCodes){
		calcData.selectedCurrenciesCodes = selectedCurrenciesCodes;
		save();
		return this.getSelectedCurrencies();
	};



	function getConverted(code){
		var account = calcData.accounts[code] || 0;
		if (code == calcData.baseCurrencyCode){
			return account;
		} else {
			return (todayRates[calcData.baseCurrencyCode] && todayRates[calcData.baseCurrencyCode][code]) ? (todayRates[calcData.baseCurrencyCode][code] * account) : 0;
		}		
	}


	// динамически формируем массив выбранных валют на основе массива кодов выбранных валют, конфигурации валют, порядка сортировки, счетов и проч.
	Service.getSelectedCurrencies = function(){
		var selectedCurrencies = [];
		var sortedCurrenciesCode = Config.sortCurrenciesCodes(calcData.selectedCurrenciesCodes, calcData.baseCurrencyCode);
		for (var index in sortedCurrenciesCode){
			var c = angular.copy(Config.availableCurrencies[sortedCurrenciesCode[index]]);
			c.account = calcData.accounts[c.code] || '';
			c.interest = calcData.interests[c.code];
			c.converted = getConverted(c.code);
			selectedCurrencies.push(c);
		}
		return selectedCurrencies;
	}
	
		


	// вспомогательная функция для Service.getPredictions
	function createPredictionsArray(val){
		var arr = [];
		for (var i = 0; i < 4; i++){
			arr.push(val);
		}			
		return arr;
	}


	// контроллер просит сервис создать прогонзы, если не созданы
	// если они уже были для выбранной базовой валюты и перечня валют с курсами, возвращаем  
	Service.getPredictions = function(rates, baseCurrencyCode){

		var notPredicted = [];

		if (!calcData.predictions[baseCurrencyCode]){ // не создавались прогнозы для этой базовой валюты
			calcData.predictions[baseCurrencyCode] = {}
			for (var k in rates){notPredicted.push(k);}
		} else { // создавались, но возможно нехватает для какой-то из выбранных валют?
			for (var k in rates){if (!calcData.predictions[baseCurrencyCode][k]){notPredicted.push(k);}}
		} 

		todayRates[baseCurrencyCode] = {};

		for (var k in rates){
			var lastVal = rates[k][rates[k].length-1].val;
			todayRates[baseCurrencyCode][k] = lastVal;
			if (notPredicted.indexOf(k) >= 0){ 
				calcData.predictions[baseCurrencyCode][k] = createPredictionsArray(lastVal);
			}
		}
		
		//console.log(calcData.predictions);

		return calcData.predictions[baseCurrencyCode];
	}
	
	
	// только обновляем для пересчёта прогнозы по курсам
	Service.updatePredictions = function(predictions, baseCurrencyCode){
		calcData.predictions[baseCurrencyCode] = angular.copy(predictions);
	}

	// сохраняем в хранилище прогнозы по курсам
	Service.setPredictions = function(predictions, baseCurrencyCode){
		this.updatePredictions(predictions, baseCurrencyCode);
		save();
	}

	// читаем и пишем флаг "с вкладами"
	Service.getInterestFlag = function(){
		return calcData.withInterests;
	}
	Service.setInterestFlag = function(val){
		calcData.withInterests = val;
		save();
	}

	
	// считаем сбережения
	Service.calculateSavings = function(){
		
		var res = {details: [], today:0, year:0, symbol: Config.availableCurrencies[calcData.baseCurrencyCode].symbol};
		
		var sorted = Config.sortCurrenciesCodes(calcData.selectedCurrenciesCodes, calcData.baseCurrencyCode);
		var wi = calcData.withInterests;
		
		for (var k in sorted){
			
			var code = sorted[k];
			var account = calcData.accounts[code] || 0;
	
			var interestCoef = (calcData.interests[code] || 0) / 400;
			var interestAmount = 0;
			var periodAmount = account;
			var predictions = calcData.predictions[calcData.baseCurrencyCode] || {};

			var data = {today: 0, year: 0, plan: []}
							
			if (code == calcData.baseCurrencyCode){ // базовая валюта, курсы и прогнозы не участвуют, только проценты
				
				for (var i =0; i < 4; i++){
					periodAmount += (wi ? interestAmount : 0);
					interestAmount = periodAmount*interestCoef;
					
					var obj = {val: periodAmount}
					if (wi){obj.interest = interestAmount}
					data.plan.push(obj);
				}
				
				data.today = account;
				data.year = data.plan[3].val + (wi ? interestAmount : 0); // начислене за последний период "выплачиваем"
				
			} else { // остальные валюты
				
				for (var i =0; i < 4; i++){
					periodAmount += (wi ? interestAmount : 0);
					interestAmount = periodAmount*interestCoef; 
					var currPredictions = predictions[code] || [];

					var obj = {val:  periodAmount * (currPredictions[i] || 0)}
					if (wi){obj.interest = interestAmount * (currPredictions[i] || 0)}
					data.plan.push(obj);
										 
				}
	
				data.today = ((todayRates[calcData.baseCurrencyCode] && todayRates[calcData.baseCurrencyCode][code]) ? todayRates[calcData.baseCurrencyCode][code] : 0) * account;
				data.year = data.plan[3].val + (wi ? ( interestAmount * (currPredictions[i-1] || 0)) : 0); // начислене за последний период "выплачиваем"
			}
			
						
			res.details.push({code: code, data: data}); // по валюте в итерации
			res.today += data.today; // общая сумма на начало
			res.year += data.year; // общая сумма через год
		}
		
		//console.log(res);

		return res;
		
	}



    return Service;
}]);