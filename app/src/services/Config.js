myApp.constant('Config', {
	appVersion: '1.0.0',
	availableCurrencies: {
		'RUB': {code: 'RUB', symbol: '₽', caption: 'Российский рубль'},
		'USD': {code: 'USD', symbol: '$', caption: 'Доллар США'},
		'EUR': {code: 'EUR', symbol: '€', caption: 'Евро'},
		'GBP': {code: 'GBP', symbol: '£', caption: 'Фунт стерлингов'},
		'CNY': {code: 'CNY', symbol: '¥', caption: 'Китайский юань'}
	},
	defaultInterests: {
		'RUB': 12,
		'USD': 20,
		'EUR': 2,
		'GBP': 2,
		'CNY': 5
	},  
	defaultSelectedCurrenciesCodes: ['RUB'],
	defaultBaseCurrencyCode: 'RUB',
	apiEndpoint: 'http://localhost/api_proxy/index.php',
	sortCurrenciesCodes: function(selectedCurrenciesCodes, baseCurrencyCode){

		var order = ['RUB', 'USD', 'EUR', 'GBP', 'CNY']; 
		
		order.splice(order.indexOf(baseCurrencyCode), 1);
		order.reverse();
		order.push(baseCurrencyCode);
		order.reverse();
		
		var sorted = [];
		for (var i = 0, qty = order.length; i < qty; i++){
			if (!selectedCurrenciesCodes || selectedCurrenciesCodes.indexOf(order[i]) >= 0){
				sorted.push(order[i]);
			}
		}
		
		return sorted;
		
	},
	getCurrencies: function(obj, codesArray){
		var res = [];
		for (var i in codesArray){
			res.push(obj[codesArray[i]]);
		} 
		return res;
	}
});