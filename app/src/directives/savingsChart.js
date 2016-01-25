myApp.directive("savingsChart", ['$window', '$filter', function($window, $filter) {
  return{
    restrict: "EA",
    template: '<svg class="savingsChart"></svg>',
	 scope: {
		 chartData: '='
	 },
    link: function(scope, elem, attrs){
		 	
		var stacked;
		var paddings = {left: 50, right: 10, top: 10, bottom: 50}
		var rectPadding = 0.02;
		var topFactor = 1.1;
		var xScale, yScale, xAxisGen, yAxisGen, yScaleReversed, z; 
		var d3 = $window.d3;
		var rawSvg=elem.find('svg');
		var svg = d3.select(rawSvg[0]);
		var svgWidth =  parseInt(svg.style('width'));
		var svgHeight =  parseInt(svg.style('height'));
		var yMax;
		  
		  
		var postfixes = [
			{power: 0, val: ''},
			{power: 3, val: 'тыс.'},
			{power: 6, val: 'млн.'},
			{power: 9, val: 'млрд.'},
			{power: 12, val: 'трлн.'}
		];
		
		var postfix;
						  
		  
		scope.$watchCollection('chartData', function(){
			if (!scope.chartData){return;}
			svg.selectAll('*').remove();
			draw();
		});

			
			// конвертация в структуру для stacked, разбор имен классов
			function prepareChartData(data){
				var withInterest;
				// начисленния по процентам переданы?
				for (var index in data.details){
					withInterest = (data.details[index].data.plan[0].interest || data.details[index].data.plan[0].interest === 0);
					break;
				}
				// обработка
				var remapped = [], classNames = [], i = 0;
				for (var index in data.details){
					var k = data.details[index].code;
					var details = data.details[index].data; 
					remapped[i] = remapped[i] || [];
					for (var j =0, qty = details.plan.length; j < qty; j++){
							remapped[i][j] = {x: j, y: details.plan[j].val}
							if (withInterest){
								remapped[i+1] = remapped[i+1] || [];
								remapped[i+1][j] = {x: j, y: details.plan[j].interest}
							}
					}
					i = (withInterest)? (i+2) : (i+1);
					classNames.push(k);
					if (withInterest){classNames.push(k + ' interest');}
				}
				return {remapped: remapped, classNames: classNames}				
			}
			
			
			
			
			function getTickPostfix(max){
				var res = postfixes[0]; 
				for (var i = 0, qty = postfixes.length; i < qty; i++){
					res = (max > Math.pow(10, postfixes[i].power) - 1) ? postfixes[i] : res;
				}
				return res;
			}
			
			
			function yAxisTickFormat(tick){
				postfix = getTickPostfix(Math.max(scope.chartData.today, scope.chartData.year));
				var tick = (tick / Math.pow(10, postfix.power)).toFixed(1);
				tick = (tick*10 % 10 == 0) ? (tick*1).toFixed(0) : tick;
				return tick.toString().replace('.',',');
			}
			
			
			function generateYTickValues(){
				var res = []
				for (var i = 0; i < 5; i++){
					res.push(i*0.25*yMax);
				}
				return res
			}
			
			// подготовка графика  
			function setChartParameters(){
				
				var preparedChartData = prepareChartData(scope.chartData);
				
				stacked = d3.layout.stack()(preparedChartData.remapped);
				
				z = d3.scale.ordinal().range(preparedChartData.classNames.reverse());				
					
				xScale = d3.scale.ordinal()
					.domain(stacked[0].map(function(d) { return d.x; }))
					.rangeRoundBands([paddings.left, svgWidth - paddings.right], rectPadding);
				
				yMax = topFactor*d3.max(stacked[stacked.length - 1], function(d) { return d.y0 + d.y; })
				
				yScaleReversed = d3.scale.linear()
					.domain([0, yMax])
					.range([svgHeight - paddings.top, paddings.bottom]);
				
				yScale = d3.scale.linear()
					.domain([0, yMax])
					.range([0, svgHeight - paddings.top - paddings.bottom]);					

				yAxisGen = d3.svg.axis()
						.scale(yScaleReversed)
						.orient("left")
						.tickValues(generateYTickValues())
						.outerTickSize(0)
						.tickPadding(-3)
						.tickFormat(yAxisTickFormat)
		}
         

		
			function formatXLabels(input){
			return $filter('niceConverted')(input) + ' ' + scope.chartData.symbol;
		}
			
			
		function draw() {

				setChartParameters();

				svg.append("svg:text")
					.attr('x', paddings.left)
					.attr('y', svgHeight - paddings.bottom)
					.attr('class', 'xLabelToday')
					.text('сегодня');
					
				svg.append("svg:text")
					.attr('x', svgWidth - paddings.right)
					.attr('y', svgHeight - paddings.bottom)
					.attr('class', 'xLabelYear')
					.text('через год');
					
				svg.append("svg:text")
					.attr('x', paddings.left)
					.attr('y', svgHeight - paddings.bottom)
					.attr('class', 'xLabelTodayValue' + ((Math.max(scope.chartData.today, scope.chartData.year) > Math.pow(10,7)) ? ' largeValue' : ''))
					.text(formatXLabels(scope.chartData.today));
					
				svg.append("svg:text")
					.attr('x', svgWidth - paddings.right)
					.attr('y', svgHeight - paddings.bottom)
					.attr('class', 'xLabelYearValue' + ((Math.max(scope.chartData.today, scope.chartData.year) > Math.pow(10,7)) ? ' largeValue' : ''))
					.text(formatXLabels(scope.chartData.year));					

				svg.append("svg:g")
					.attr("class", "axis")
					.attr("transform", "translate(" + (paddings.left) + "," + (paddings.top-paddings.bottom) + ")")
					.call(yAxisGen);

				svg.append("svg:text")
					.attr('x', paddings.left)
					.attr('y', paddings.top)
					.attr('class', 'yLabelTickPostfix')
					.text(postfix.val + ' ' + scope.chartData.symbol);

            var currencyGroup = svg.selectAll("g.currencyGroup")
            .data(stacked.reverse())
            .enter().append("svg:g")
            .attr("class", function(d, i) { return "currencyGroup " + z(i); })

            currencyGroup.selectAll("rect")
            .data(function(d){return d;})
            .enter().append("svg:rect")
            .attr("x", function(d) { return xScale(d.x); })
            .attr("y", function(d) { return svgHeight - yScale(d.y0) - yScale(d.y) - paddings.bottom})
            .attr("height", function(d) { return (yScale(d.y) == 0) ? 0 : (yScale(d.y) + yScale(d.y0)); }) // чтобы не было артефактов, поскольку stacked не совсем обычный
            .attr("width", xScale.rangeBand());					
				
		}
	 
		 
    }
  };
}]);