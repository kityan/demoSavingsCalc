myApp.config(['$routeProvider', function($routeProvider){
	$routeProvider
		.when('/', {
			controller: 'HomeCtrl',
			templateUrl: 'views/home.html'
		})
		.otherwise({redirectTo: '/'});
}]);
