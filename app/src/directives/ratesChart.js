myApp.directive("ratesChart", ['$window', '$filter', function($window, $filter) {
	return{
		restrict: "EA",
		template: '<svg class="ratesChart"></svg>',

		scope: {
			chartData: '=',
			updatePredictionsProgress: '&',
			updatePredictionsEnd: '&',
		},

		link: function(scope, elem, attrs){

			var arrays;
			var paddings = {left: 45, right: 20, top: 10, bottom: 35}

			var r = 3;
			var topFactor = 1.5;
			var bottomFactor = 0.5;
			var pathClass="currency";
			var xScale, yScale, yAxisGen, lineFun, drag, labelsPrecision, bottomLimit, yMax, yMin; 
			var d3 = $window.d3;
			var rawSvg=elem.find('svg');
			var svg = d3.select(rawSvg[0]);
			var svgWidth =  parseInt(svg.style('width'));
			var svgHeight =  parseInt(svg.style('height'));
			var topLabelDragLimiter = 10;
				
			  /*
			  
			  [+] доработать?
			  
			  // http://stackoverflow.com/questions/17626555/responsive-d3-chart
				svg
				.attr("width", '100%')
				.attr("height", '100%')
				.attr('viewBox','0 0 '+Math.min(850,200)+' '+Math.min(850,200))
				.attr('preserveAspectRatio','xMinYMin')
				.append("g")
				.attr("transform", "translate(" + Math.min(850,200) / 2 + "," + Math.min(850,200) / 2 + ")");
				*/

			scope.$watchCollection('chartData', function(){
				if (!scope.chartData){return;}
				injectPredictions(scope.chartData.rates, scope.chartData.predictions);
				svg.selectAll('*').remove();
				draw();
			});

			
			// внедряем переданные прогнозы
			function injectPredictions(rates, predictions) {

				var injection = {}
				
				for (var k in rates){
					var lastDt = new Date(rates[k][rates[k].length-1].dt); // последняя дата
					
					// готовим стуктуру для внедрения в курсовые данные для построения единой кривой
					injection[k] = [];
					for (var i = 0; i < 4; i++){				
						injection[k].push({
								dt: $filter('date')(lastDt.setMonth(lastDt.getMonth()+3), 'yyyy-MM-dd'),
								val: predictions[k][i]
						});
					}
					
					// внедряем
					rates[k] = rates[k].concat(injection[k]);
				}
			}	
		
		

			function setChartParameters(){
			
				arrays = [];
				for (var k in scope.chartData.rates){
					arrays.push(scope.chartData.rates[k]);
				}

				yMax = topFactor*d3.max(arrays, function(d) {
					return d3.max(d, function(d){return d.val;});
				});
				
				yMin = bottomFactor*d3.min(arrays, function(d) {
					return d3.min(d, function(d){return d.val;});
				});
				

				xScale = d3.scale.linear()
					.domain([new Date(arrays[0][0].dt), new Date(arrays[0][arrays[0].length-1].dt)])
					.range([paddings.left, svgWidth - paddings.right]);


				//размах y-шкалы, чтобы определять, как огруглять лейблы маркеров				
				var yDiff = Math.abs(1.25*yMax - 0.75*yMin);
				
				if (yDiff > 50) {
					labelsPrecision = 0;	
					bottomLimit = 1;
				} else if (yDiff > 20) {
					labelsPrecision = 1;
					bottomLimit = 0.1
				} else if (yDiff > 10) {
					labelsPrecision = 2;
					bottomLimit = 0.01
				} else {
					labelsPrecision = 4;
					bottomLimit = 0.0001
				}
				

				yScale = d3.scale.linear()
					.domain([bottomLimit, yMax])
					.range([svgHeight - paddings.bottom, paddings.top ]);


				

				lineFun = d3.svg.line()
						.x(function (d, i) {return xScale(new Date(d.dt));})
						.y(function (d) {return yScale(d.val);});
					
				yAxisGen = d3.svg.axis()
					.scale(yScale)
					.orient("left")
					.tickValues(generateYTickValues());
					//.ticks(5);


				drag = d3.behavior.drag()
					.on('dragstart', function() {
						
						// чтобы курсор был всё время s-resize, а не только над маркерами
						svg.attr('class', svg.attr('class') + ' duringDrag'); 
						
						var el = d3.select(this);
						var params = el.attr('id').split("_"); 
						
						// отобразим все лейблы маркеров этой  кривой
						svg.selectAll('text.prediction.' + params[1])
							.style('visibility', 'visible');
					})
					.on('drag', function() { 
							var y = d3.event.y;
							var h = rawSvg.attr("height") - paddings.bottom;
							y = (y < paddings.top + topLabelDragLimiter) ? paddings.top + topLabelDragLimiter : y;
							y = (yScale.invert(y) < bottomLimit) ? yScale(bottomLimit) : y;
							
							var el = d3.select(this); 
							el.attr('cy', y);
							var params = el.attr('id').split("_");
							// обновляем и двигаем лейбл
							svg.select('#text_' + params[1] + '_' + params[2])
								.attr('y', y)
								.text(yScale.invert(y).toFixed(labelsPrecision));
							redraw(params[1], params[2]*1, y);
							
							// обновляем predictions в scope
							scope.chartData.predictions[params[1]][params[2]*1] = yScale.invert(y*1).toFixed(labelsPrecision)*1;
							// вызываем обработчик событий
							scope.updatePredictionsProgress({data: scope.chartData.predictions});					
					})
					.on('dragend', function() {
							
							svg.attr('class', svg.attr('class').replace('duringDrag',''));
							
							// прячем лейблы маркров 
							svg.selectAll('text.prediction').style('visibility', 'hidden');

							// обновляем predictions в scope
							var el = d3.select(this); 
							var params = el.attr('id').split("_");
							scope.chartData.predictions[params[1]][params[2]*1] = yScale.invert(el.attr('cy')*1).toFixed(labelsPrecision)*1;
							// вызываем обработчик событий
							scope.updatePredictionsEnd({data: scope.chartData.predictions});
					});
				
				}
				
				
				// перерисуем график
				function redraw(currencyCode, predictionsId, predictionValue) {
						// меняем точку согласно положению маркера
						var pos = scope.chartData.rates[currencyCode].length - 4 + predictionsId; 
						//console.log(pos);
						scope.chartData.rates[currencyCode][pos].val = yScale.invert(predictionValue);
						
						svg.select("path." + currencyCode)
							.attr({
								d: lineFun(scope.chartData.rates[currencyCode])
							});				
				}
				
				
				// сетка (переделать на http://www.d3noob.org/2013/01/adding-grid-lines-to-d3js-graph.html ?)
				function drawGrid(h,v){
            	var grid = svg.append("svg:g").attr('class', 'grid');
					for (var i = 0; i <= h; i++){
							var y = i*(svgHeight - paddings.top - paddings.bottom)/(h) + paddings.top;
							grid.append("svg:line")
								.attr("x1", paddings.left)
								.attr("y1", y)
								.attr("x2", svgWidth - paddings.right)
								.attr("y2", y)
					}
					for (var i = 0; i <= v; i++){
							var x= i*(svgWidth - paddings.left - paddings.right)/(v) + paddings.left;
							grid.append("svg:line")
								.attr("x1", x)
								.attr("y1", paddings.top)
								.attr("x2", x)
								.attr("y2", svgHeight - paddings.bottom)
					}					
				}
				
				
			function generateYTickValues(){
				var res = []
				for (var i = 1; i <= 5; i++){
					res.push(i*0.20*yMax);
				}
				return res
			}				
				
				
				// отрисовка графика
				function draw() {
					
				setChartParameters();

				drawGrid(5,4);

				svg.append("svg:text")
					.attr('x', (svgWidth/2) + paddings.left/2 - paddings.right/2)
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
					.attr('class', 'xLabelYearBefore')
					.text('год назад');					
					
				svg.append("svg:g")
					.attr("class", "axis")
					.attr("transform", "translate(" + paddings.left + "," + (0) + ")")
					.call(yAxisGen);

				
					for (var k in scope.chartData.rates){
						svg.append("svg:path")
							.attr({
								d: lineFun(scope.chartData.rates[k]),
								"class": pathClass + " " + k
							});
					}
					
					
					// по данным последних четырёх точек каждой кривой отображаем маркеры
					for (var k in scope.chartData.rates){
						svg.selectAll('circle.prediction.' + k)
							.data(scope.chartData.rates[k].slice(scope.chartData.rates[k].length-4))
							.enter()
							.append('svg:circle')
							.attr('class', 'prediction ' + k)
							.attr('id', function(d, i) {return 'circle_' + k + '_' + i;})
							.attr('cx', function(d) {return xScale(new Date(d.dt)); })
							.attr('cy', function(d) { return yScale(d.val); })
							.attr('r', r)
							.call(drag);
					}
					
					// текстовые
					for (var k in scope.chartData.rates){				
						svg.selectAll('text.prediction.' + k)
						.data(scope.chartData.rates[k].slice(scope.chartData.rates[k].length-4))
						.enter()
						.append("svg:text")
						.attr('class', 'prediction ' + k)
						.attr('id', function(d, i) {return 'text_' + k + '_' + i;})
						.attr('x', function(d) {return xScale(new Date(d.dt)); })
						.attr('y', function(d) { return yScale(d.val); })					
						.text(function(d) {return d.val.toFixed(labelsPrecision);});								
					}
					
			}
	 
		 
    }
  };
}]);