myApp.controller('AddCurrencyModalCtrl', ['$scope', 'Config', '$uibModalInstance', 'selectedCurrenciesCodes', 'baseCurrencyCode', function($scope, Config, $uibModalInstance, selectedCurrenciesCodes, baseCurrencyCode){

	$scope.selectedCurrenciesCodes = selectedCurrenciesCodes;
	$scope.baseCurrencyCode = baseCurrencyCode;
	$scope.availableCurrencies = 	Config.getCurrencies(Config.availableCurrencies, Config.sortCurrenciesCodes(null, baseCurrencyCode));	
		
	

	$scope.ok = function () {
		//$uibModalInstance.dismiss('cancel');
		if ($scope.selectedCurrenciesCodes.indexOf($scope.baseCurrencyCode)>=0){
			$uibModalInstance.close({selectedCurrenciesCodes: $scope.selectedCurrenciesCodes, baseCurrencyCode: $scope.baseCurrencyCode});
		}
	};	
	
	
	$scope.getNewSelectedCurrencies = function(){
		var res = []
		for (var index in $scope.availableCurrencies){
			if ($scope.selectedCurrenciesCodes.indexOf($scope.availableCurrencies[index].code) >= 0){
				res.push($scope.availableCurrencies[index]);
			}
		}
		return res;		
	}
	
	
  
}]);


