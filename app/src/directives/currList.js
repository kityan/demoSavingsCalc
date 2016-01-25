myApp.directive("currList", ['$compile', '$window', '$filter', function($compile, $window, $filter) {
	return{
		restrict: "EA",
		template: '<div class="container"></div>',
		scope: {
			availableCurrencies: '=',
			selectedCurrenciesCodes: '='
		},

		link: function(scope, elem, attrs){
			scope.$watchCollection('chartData', function(){
				if (!scope.chartData){return;}
			});

			var row = angular.element('<div class="row currList" />');
			elem.append(row);

			scope.click = function(code){
				var cols = row.children();
				for (var i =0, qty = cols.length; i < qty; i++){
					var col = angular.element(cols[i]);
					if (col.hasClass(code)){
						if (col.hasClass('selected')){
							col.removeClass('selected');
							scope.selectedCurrenciesCodes.splice(scope.selectedCurrenciesCodes.indexOf(code), 1);
						} else {
							col.addClass('selected');
							scope.selectedCurrenciesCodes.push(code);							
						}
					}
				}
			}
							
			for (var index in scope.availableCurrencies){
				var code = scope.availableCurrencies[index].code;
				var selected = scope.selectedCurrenciesCodes.indexOf(code) >= 0;
				var col = angular.element('<div class="col-xs-4 text-center" ng-click="click(\'' + code + '\')" />');
				col.append('<span class="noselect">' + scope.availableCurrencies[index].symbol + '</span>')
				col.addClass('currency ' + code);
				if (selected){col.addClass('selected');}
				$compile(col)(scope);
				row.append(col);
			}
				

		}
	 
	 
  };
}]);