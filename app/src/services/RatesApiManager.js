myApp.factory('RatesApiManager', ['Config', '$resource', '$filter', function(Config, $resource, $filter) {

	var Service = {};
	
	Service.api = 	$resource(Config.apiEndpoint, {}, {get: {method: "GET"}});
	
	// получаем курсы
	Service.getRates = function(baseCurrencyCode, selectedCurrenciesCodes){
		
		return this.api.get({
			to: $filter('date')(new Date(), 'yyyy-MM-dd'), 
			b: baseCurrencyCode, 
			c: selectedCurrenciesCodes.join(';')});
	}

    return Service;
	 
}]);