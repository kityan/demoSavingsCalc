var myApp = angular.module("myApp", ['ngRoute', 'ngResource', 'ui.bootstrap', 'base64']);
	
myApp.run(['$rootScope', '$location', function ($rootScope, $location) {}]);


myApp.filter('niceConverted', function(){
	return function(input){
		if (!input){return ''};
		if (input < 1000){return input.toFixed(2).toString().replace('.',',');}
		else {return Math.floor(input).toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, " ");}		
	}
});









