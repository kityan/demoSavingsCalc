myApp.controller('HomeCtrl', ['$scope', 'Config', '$uibModal', 'Calc', 'RatesApiManager', '$timeout', '$filter', '$location', '$routeParams', 
function($scope, Config, $uibModal, Calc, RatesApiManager, $timeout, $filter, $location, $routeParams){

	if ($routeParams.import){
		Calc.import($routeParams.import);
		$scope.importWarning = true;
	}
	
	$scope.saveImported = function(){
		Calc.saveImported();
		$scope.importWarning = false;
	}	
	
	// получаем из хранилища сохранённые параметры (или автоматически созданного по умолчаниям)
	$scope.baseCurrencyCode = Calc.getBaseCurrencyCode();
	$scope.selectedCurrencies = Calc.getSelectedCurrencies();
	$scope.interestFlag = Calc.getInterestFlag();
			
	// первичный запрос
	getRates();
	refreshSavings();
	preapareLink();
	
		
	// при изменении базовой валюты
	$scope.baseCurrencyCodeChange = function(a){
		$scope.selectedCurrencies = Calc.setBaseCurrencyCode($scope.baseCurrencyCode); // делаем пересортировку
		getRates();
	}	
	
	// сохраняем состояние флага "с вкладами"
	$scope.interestFlagChange = function(val){
		Calc.setInterestFlag(val);
		refreshSavings();
	}
		
	// при изменении счёта валюты
	$scope.accountChange = function(code, value){
		Calc.setAccount(code, value, $scope.selectedCurrencies); // $scope.selectedCurrencies передаём, чтобы обновить в нём конвертацию [рефакторить?]
		refreshSavings();
	}
	
	// при ставок
	$scope.interestChange = function(code, value){
		Calc.setInterest(code, value, $scope.selectedCurrencies); // $scope.selectedCurrencies передаём, чтобы обновить в нём конвертацию [рефакторить?]
		refreshSavings();
	}
		
	// обновляем прогнозы, изменённые в директиве графика, чтобы динамично менять второй график
	$scope.updatePredictions = function(predictions){
		Calc.updatePredictions(predictions, $scope.baseCurrencyCode);
		refreshSavings();
	};	
		
	
	// сохраняем прогнозы, изменённые в директиве графика
	$scope.setPredictions = function(predictions){
		Calc.setPredictions(predictions);
	};		


	 // вызов диалога выбора валют
	$scope.addCurrency = function () {

		var modalInstance = $uibModal.open({
			animation: true, 
			templateUrl: 'views/modals/addCurrency.html',
			controller: 'AddCurrencyModalCtrl',
			resolve: {
				selectedCurrenciesCodes: function() {
					return $scope.selectedCurrencies.map(function(d){return d.code;})
				},
				baseCurrencyCode: function() {
					return $scope.baseCurrencyCode;
				}				
			}
		});

		modalInstance.result.then(function (newSelection) {
			$scope.baseCurrencyCode = newSelection.baseCurrencyCode;
			Calc.setBaseCurrencyCode(newSelection.baseCurrencyCode);
			$scope.selectedCurrencies = Calc.setSelectedCurrenciesCodes(newSelection.selectedCurrenciesCodes); // сохраняем и делаем пересортировку
			refreshSavings();
			getRates();
			preapareLink();
		});
		
	};





	// получаем курсы
	function getRates() {
		if ($scope.selectedCurrencies.length > 1) {	// запрашиваем курсы, если у нас несколько валют
			RatesApiManager.getRates(
					$scope.baseCurrencyCode, 
					$scope.selectedCurrencies.map(function(d){return d.code;}))
				.$promise.then(function(res){
					$scope.ratesChartData = {
						rates: res.data, 
						predictions: Calc.getPredictions(res.data, $scope.baseCurrencyCode)
					}	
					// обновим, поскольку теперь есть курсы для конвертации
					$scope.selectedCurrencies = Calc.getSelectedCurrencies();
					refreshSavings();			
				});
		}
	}
	
	function refreshSavings(){
		$timeout(function(){$scope.savingsChartData = Calc.calculateSavings();}, 0);
		preapareLink();
	}
	
	function preapareLink(){
		$scope.link = $location.protocol() + '://' +  $location.host() + (($location.port() != 80) ? (":" +  $location.port()) : "") + '/#?import=' + Calc.getExportString();
	}


}]);


