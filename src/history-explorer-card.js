
import "./moment.min.js";
import "./Chart.min.js";
import "./timeline.js";

var isMobile = ( navigator.appVersion.indexOf("Mobi") > -1 );

var ui = {};
	ui.dateSelector  = null;
	ui.rangeSelector = null;
	ui.darkMode		 = false;

var i18n = {};
	i18n.styleDateSelector 	  = '';
	i18n.styleTimeTicks 	  = '';
	i18n.styleDateTicks 	  = '';
	i18n.styleDateTimeTooltip = '';

var pconfig = {};
	pconfig.graphLabelColor 	 = '#333';
	pconfig.graphGridColor       = '#00000000';
	pconfig.customStateColors	 = {};
	pconfig.graphConfig			 = [];
	pconfig.lockAllGraphs        = false;
	pconfig.enableDataClustering = true;

var loader = {};
	loader.startTime 	= 0;
	loader.endTime 		= 0;
	loader.startIndex 	= -1;
	loader.endIndex 	= -1;

var state = {};
	state.drag 			= false;
	state.updateCanvas 	= null;
	state.loading 		= false;

var activeRange = {};
	activeRange.timeRangeHours 	= 24;
	activeRange.tickStepSize 	= 1;
	activeRange.dataClusterSize = 0;
	activeRange.currentTimeRangeIndex = 0;

var graphs = [];

var startTime;
var endTime;


// --------------------------------------------------------------------------------------
// Predefined state colors for timeline history
// --------------------------------------------------------------------------------------

var stateColors = { 

		'Multiple' : 'rgb(213, 142, 142)',

		'on' : "#cd3e3e", 
		'off' : "#dddddd", 

		'home' : '#66a61e',
		'not_home' : '#b5342d',
		'arriving' : '#d5bd43',

		'Eco' : '#44739e', 
		'Confort - 2' : '#984ea3', 
		'Confort - 1' : '#00d2d5', 
		'Confort' : '#ff7f00'
};

var stateColorsDark = { 

		'off' : "#333333", 
};

function getStateColor(value)
{
	let c;

	if( pconfig.customStateColors ) 
		c = pconfig.customStateColors[value];

	if( !c ) {
		c = ui.darkMode ? stateColorsDark[value] ? stateColorsDark[value] : stateColors[value] : stateColors[value];
		c = c ? c : ui.darkMode ? "#333333" : "#dddddd";
	}

	return c;
}


// --------------------------------------------------------------------------------------
// UI element handlers
// --------------------------------------------------------------------------------------

function subDay()
{
	if( !state.loading ) {

		if( activeRange.currentTimeRangeIndex < 4 ) setTimeRange(4, false);

		let t0 = moment(startTime).subtract(1, "day");
		let t1 = moment(t0).add(activeRange.timeRangeHours, "hour");
		startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
		endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

		updateHistory();

	}
}

function addDay()
{
	if( !state.loading ) {

		if( activeRange.currentTimeRangeIndex < 4 ) setTimeRange(4, false);

		let t0 = moment(startTime).add(1, "day");
		let t1 = moment(t0).add(activeRange.timeRangeHours, "hour");
		startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
		endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

		updateHistory();

	}
}

function decZoom()
{
	setTimeRange(activeRange.currentTimeRangeIndex+1, true);
}

function incZoom()
{
	setTimeRange(activeRange.currentTimeRangeIndex-1, true);
}

function timeRangeSelected(event)
{
	setTimeRange(event.target.selectedIndex, true);
}

function setTimeRange(index, update)
{
	if( state.loading ) return;

	const minute = 60000;

	index = ( index < 0 ) ? 0 : ( index > 10 ) ? 10 : index;

	switch( index ) {
		case 0: activeRange.timeRangeHours = 1; activeRange.tickStepSize = 5; activeRange.dataClusterSize = 0 * minute; break;
		case 1: activeRange.timeRangeHours = 2; activeRange.tickStepSize = 10; activeRange.dataClusterSize = 0 * minute; break;
		case 2: activeRange.timeRangeHours = 6; activeRange.tickStepSize = 30; activeRange.dataClusterSize = 0 * minute; break;
		case 3: activeRange.timeRangeHours = 12; activeRange.tickStepSize = 60; activeRange.dataClusterSize = 0 * minute; break;
		case 4:	activeRange.timeRangeHours = 24*1; activeRange.tickStepSize = 2; activeRange.dataClusterSize = 0 * minute; break;
		case 5:	activeRange.timeRangeHours = 24*2; activeRange.tickStepSize = 2; activeRange.dataClusterSize = 2 * minute; break;
		case 6:	activeRange.timeRangeHours = 24*3; activeRange.tickStepSize = 6; activeRange.dataClusterSize = 5 * minute; break;
		case 7:	activeRange.timeRangeHours = 24*4; activeRange.tickStepSize = 6; activeRange.dataClusterSize = 10 * minute; break;
		case 8:	activeRange.timeRangeHours = 24*5; activeRange.tickStepSize = 12; activeRange.dataClusterSize = 30 * minute; break;
		case 9:	activeRange.timeRangeHours = 24*6; activeRange.tickStepSize = 12; activeRange.dataClusterSize = 30 * minute; break;
		case 10:activeRange.timeRangeHours = 24*7; activeRange.tickStepSize = 24; activeRange.dataClusterSize = 60 * minute; break;
	}

	if( !pconfig.enableDataClustering ) activeRange.dataClusterSize = 0;

	activeRange.currentTimeRangeIndex = index;

	ui.rangeSelector.value = activeRange.timeRangeHours;

	for( let g of graphs ) {
		g.chart.options.scales.xAxes[0].time.unit = ( activeRange.timeRangeHours < 24 ) ? 'minute' : 'hour';
		g.chart.options.scales.xAxes[0].time.stepSize = activeRange.tickStepSize;
		g.chart.update();
	}

	if( update ) {

		if( activeRange.timeRangeHours > 24 ) {

			let t1 = moment(endTime);
			let t0 = moment(t1).subtract(activeRange.timeRangeHours, "hour");
			startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
			endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

		} else {

			let tm = (moment(endTime) + moment(startTime)) / 2;
			let t1 = moment(tm).add(activeRange.timeRangeHours / 2, "hour");
			let t0 = moment(t1).subtract(activeRange.timeRangeHours, "hour");
			startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
			endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

		}

		updateHistory();

	}
}



// --------------------------------------------------------------------------------------
// Helper functions
// --------------------------------------------------------------------------------------

function findFirstIndex(array, range, predicate)
{
	let l = range.start - 1;
	while( l++ < range.end ) {
		if( predicate(array[l]) ) return l;
	}
	return -1;
}

function findLastIndex(array, range, predicate)
{
	let l = range.end + 1;
	while( l-- > range.start ) {
		if( predicate(array[l]) ) return l;
	}
	return -1;
}


// --------------------------------------------------------------------------------------
// Cache control
// --------------------------------------------------------------------------------------

var cache = [];

function initCache()
{
	let d = moment().format("YYYY-MM-DD") + "T00:00:00";
	d = moment(d).subtract(30, "day").format("YYYY-MM-DD") + "T00:00:00";
	
	for( let i = 0; i < 31; i++ ) {
		let e = moment(d).add(1, "day").format("YYYY-MM-DD") + "T00:00:00";
		cache.push({ "start" : d, "end" : e, "data" : [], "valid": false });
		d = e;
	}
}

function mapStartTimeToCacheSlot(t)
{
	let mt = moment(t);

	for( let i = 0; i < 31; i++ ) {
		if( mt >= moment(cache[i].start) && mt < moment(cache[i].end) ) return i;
	}

	if( mt < moment(cache[0].start) ) return 0;

	return -1;
}

function mapEndTimeToCacheSlot(t)
{
	let mt = moment(t);

	for( let i = 0; i < 31; i++ ) {
		if( mt > moment(cache[i].start) && mt <= moment(cache[i].end) ) return i;
	}

	if( mt > moment(cache[30].end) ) return 30;

	return -1;
}

function generateGraphDataFromCache()
{
	let c0 = mapStartTimeToCacheSlot(startTime);
	let c1 = mapEndTimeToCacheSlot(endTime);

	if( c0 >= 0 && c1 >= 0 ) {

//		console.log(`merge from ${c0} to ${c1}`);

		// Build partial data
		let result = [];
		for( let i = c0; i <= c1; i++ ) {
			for( let j = 0; j < cache[i].data.length; j++ ) {
				if( result[j] == undefined ) result[j] = [];
				result[j] = result[j].concat(cache[i].data[j]);
			}
		}

		// 
		if( c0 > 0 && cache[c0-1].valid && cache[c0-1].data.length == result.length ) {
			for( let j = 0; j < result.length; j++ ) {
				let n = cache[c0-1].data[j].length;
				if( n > 0 ) 
					result[j].unshift({ "last_changed": cache[c0].start, "state": cache[c0-1].data[j][n-1].state });
			}
		}

		buildChartData(result);

	} else

		buildChartData(null);
}


// --------------------------------------------------------------------------------------
// On demand history retrieval
// --------------------------------------------------------------------------------------

function loaderCallback(result)
{
//	console.log("database retrieval OK");
//	console.log(result);

	if( loader.startIndex == loader.endIndex ) {

		// Retrieved data maps to a single slot directly

		cache[loader.startIndex].data = result;
		cache[loader.startIndex].valid = true;

	} else {

		// Retrieved multiple slots, needs to be split accordingly

		for( let i = loader.startIndex; i <= loader.endIndex; i++ ) {
			cache[i].data = [];
			cache[i].valid = true;
		}

		for( let j of result ) {

			let p0 = 0;

			for( let i = loader.startIndex; i <= loader.endIndex; i++ ) {

				// Find first index that doesn't fit into cache slot [i] anymore (one after the end of the slot data)
				let t = moment(cache[i].end);
				let p1 = findFirstIndex(j, { start: p0, end: j.length-1 }, function(e) { return moment(e.last_changed) >= t });

				// If none found, this means that everything up to the end goes into the current slot
				if( p1 < 0 ) p1 = j.length;

				// Copy the valid part into the current cache slot
				let r = j.slice(p0, p1);
				cache[i].data.push(r);

				// Next slot range
				p0 = p1;

			}

		}

	}

	generateGraphDataFromCache();

	state.loading = false;
}

function loaderFailed(error) 	
{
	console.log("Database request failure");
	console.log(error);

	buildChartData(null);
}


// --------------------------------------------------------------------------------------
// Graph data generation
// --------------------------------------------------------------------------------------

function buildChartData(result)
{
	let m_now = moment();
	let m_start = moment(startTime);
	let m_end = moment(endTime);

	let id = 0;

	for( let g of graphs ) {

		let updated = false;

		for( let j = 0; j < g.entities.length; j++, id++ ) {

			if( state.updateCanvas && state.updateCanvas !== g.canvas ) continue;

			var s = [];

			if( result && result.length > id ) {

				var n = result[id].length;

				if( g.type == 'line' ) {

					// Fill line chart buffer

					if( activeRange.dataClusterSize > 0 ) {

						let last_time = moment(result[id][0].last_changed);

						for( let i = 0; i < n; i++ ) {
							let this_time = moment(result[id][i].last_changed);
							if( i > 0 && this_time.diff(last_time) >= activeRange.dataClusterSize ) {
								s.push({ x: this_time, y: result[id][i].state});
								last_time = this_time;
							}
						}

 					} else {

						for( let i = 0; i < n; i++ ) {
							s.push({ x: result[id][i].last_changed, y: result[id][i].state});
						}
					}
					
					if( !state.drag && m_now > m_end && moment(s[s.length-1].x) < m_end ) {
						s.push({ x: m_end, y: result[id][n-1].state});
					}

				} else if( g.type == 'timeline' ) {				

					// Fill timeline chart buffer

					let merged = 0;
					let mt0, mt1;

					for( let i = 0; i < n; i++ ) {

						let t0 = result[id][i].last_changed;
						let t1 = ( i < n-1 ) ? result[id][i+1].last_changed : endTime;

						if( moment(t1).diff(moment(t0)) >= activeRange.dataClusterSize ) {
							if( merged > 0 ) {
								t0 = mt0;
								t1 = mt1;
								i--;
							}
						} else {
							if( !merged ) mt0 = t0;
							mt1 = t1;
							merged++;
							continue;
						}

						if( moment(t1) >= m_start ) {
							if( moment(t1) > m_end ) t1 = endTime;
							if( moment(t0) > m_end ) break;
							if( moment(t0) < m_start ) t0 = startTime;
							var e = [];
							e.push(t0);
							e.push(t1);
							e.push(( merged > 1 ) ? 'Multiple' : result[id][i].state);
							s.push(e);
						}

						merged = 0;

					}

				}

			}

			g.chart.data.datasets[j].data = s;

			updated = true;

		}

		if( updated ) {

			g.chart.options.scales.xAxes[0].time.min = startTime;
			g.chart.options.scales.xAxes[0].time.max = endTime;

			g.chart.update();

		}

	}
}


// --------------------------------------------------------------------------------------
// New graph creation
// --------------------------------------------------------------------------------------

function newGraph(canvas, graphtype, datasets)
{
	const ctx = canvas.getContext('2d');

	var datastructure;

	if( graphtype == 'line' ) {

		datastructure = {
			datasets: []
		};

		for( let d of datasets ) {
			datastructure.datasets.push({
				borderColor: d.bColor,
				backgroundColor: d.fillColor,
				borderWidth: d.width,
				pointRadius: 0,
				hitRadius: 5,
				label: d.name,
				steppedLine: d.stepped,
				cubicInterpolationMode: 'monotone',
				entity_id: d.entity_id,
				unit: d.unit,
				data: { }
			});
		}

	} else if( graphtype == 'timeline' ) {
	
		datastructure = {
			labels: [ ],
		    datasets: [ ]
		};

		for( let d of datasets ) {
			datastructure.labels.push(d.name);
			datastructure.datasets.push({ "data": [ ] });
		}

	}

	var chart = new Chart(ctx, { 

		type: graphtype, 

		data: datastructure,

		options: {
			scales: {
				xAxes: [{ 
					type: ( graphtype == 'line' ) ? 'time' : 'timeline',
					time: {
						unit: ( activeRange.timeRangeHours < 24 ) ? 'minute' : 'hour',
						stepSize: activeRange.tickStepSize,
						displayFormats: { 'minute': i18n.styleTimeTicks, 'hour': i18n.styleTimeTicks, 'day': i18n.styleDateTicks },
						tooltipFormat: i18n.styleDateTimeTooltip,
					},
					ticks: {
						fontColor: pconfig.graphLabelColor,
						major: {
							enabled: true,
							unit: 'day',
							fontStyle: 'bold',
							unitStepSize: 1,
							displayFormats: { 'day': i18n.styleDateTicks },
						}
					},
					gridLines: {
						color: pconfig.graphGridColor
					}
				}],
				yAxes: [{
					afterFit: (scaleInstance) => {
						scaleInstance.width = 65;
					},
					ticks: {
						fontColor: pconfig.graphLabelColor
					},
					gridLines: {
						color: pconfig.graphGridColor
					}
				}],
			},
			animation: {
				duration: 0
			},
			tooltips: {
				callbacks: {
					label: function(item, data) {
						if( graphtype == 'line' ) {
							let label = data.datasets[item.datasetIndex].label || '';
							if( label ) label += ': ';
							label += Math.round(item.yLabel * 100) / 100;
							label += ' ' + data.datasets[item.datasetIndex].unit || '';
							return label;
						} else {
							let d = data.datasets[item.datasetIndex].data[item.index];
							return [d[2], moment(d[0]).format(i18n.styleDateTimeTooltip), moment(d[1]).format(i18n.styleDateTimeTooltip)];
						}
					}
				}
			},
			hover: {
				mode: 'nearest'
			},
			legend: {
				display: ( graphtype == 'line' ),
				labels: {
					fontColor: pconfig.graphLabelColor,
					usePointStyle: true
				}
			},
			elements: {
		        colorFunction: function(text, data, dataset, index) {
					return getStateColor(data[2]);
		        },
		        showText: true,
				font: 'normal 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
		        textPadding: 4
		    },
			responsive: true,
			maintainAspectRatio: false
		}
	});

	return chart;
}


// --------------------------------------------------------------------------------------
// Rebuild the charts for the current start and end time, load cache as needed
// --------------------------------------------------------------------------------------

function updateHistory()
{
	ui.dateSelector.innerHTML = moment(startTime).format(i18n.styleDateSelector);

	// Prime the cache on first call
	if( !cache.length ) initCache();

	// Get cache slot indices for beginning and end of requested time range
	let c0 = mapStartTimeToCacheSlot(startTime);
	let c1 = mapEndTimeToCacheSlot(endTime);

//	console.log(`Slots ${c0} to ${c1}`);

	// Get the cache slot (sub)range that needs to be retrieved from the db
	let l0 = ( c0 >= 0 ) ? findFirstIndex(cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;
	let l1 = ( c1 >= 0 ) ? findLastIndex(cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;

	if( l0 >= 0 ) {

		// Requested data range is not yet loaded. Get it from database first and update the chart data aysnc when fetched.

		// TODO: handle this with a scheduled reload
		if( state.loading ) {
			if( l0 >= loader.startIndex && l1 <= loader.endIndex ) return;
			console.log(`Slots ${l0} to ${l1} need loading`);
			console.log(`Double loading blocked, slots ${loader.startIndex} to ${loader.endIndex} are currently loading`);
			return;			
		}

		//console.log(`Slots ${l0} to ${l1} need loading`);

		state.loading = true;

		loader.startTime = cache[l0].start;
		loader.endTime = cache[l1].end;
		loader.startIndex = l0;
		loader.endIndex = l1;

		// Issue db retrieval request to HA, async
		let t0 = loader.startTime.replace('+', '%2b');
		let t1 = loader.endTime.replace('+', '%2b');
		let url = `history/period/${t0}?end_time=${t1}&minimal_response&filter_entity_id`;
		let separator = '=';
		for( let g of graphs ) {
			for( let e of g.entities ) {
				url += separator;
				url += e.entity;
				separator = ',';
			}
		}
//		console.log(url);

		const p = callHassAPIGet(url);
		p.then(loaderCallback, loaderFailed);

	} else

		// All needed slots already in the cache, generate the chart data
		generateGraphDataFromCache();
}

function updateAxes()
{
	for( let g of graphs ) {
		if( !state.updateCanvas || state.updateCanvas === g.canvas ) {
			g.chart.options.scales.xAxes[0].time.min = startTime;
			g.chart.options.scales.xAxes[0].time.max = endTime;
			g.chart.update();
		}
	}
}


// --------------------------------------------------------------------------------------
// Panning
// --------------------------------------------------------------------------------------

var panstate = {};
	panstate.mx = 0;
	panstate.tc = 0;
	panstate.g 	= null;

function pointerDown(event)
{
	panstate.g = null;

	for( let g of graphs ) {
		if( g.canvas === event.target ) {
			panstate.g = g;
			g.chart.options.tooltips.enabled = false;
			g.chart.options.scales.yAxes[0].ticks.min = g.chart.scales["y-axis-0"].min;
			g.chart.options.scales.yAxes[0].ticks.max = g.chart.scales["y-axis-0"].max;
			break;
		}
	}		

	if( panstate.g ) {

		state.drag = true;

		panstate.mx = event.clientX;
		panstate.tc = startTime;

		event.target?.setPointerCapture(event.pointerId);

		state.updateCanvas = pconfig.lockAllGraphs ? null : event.target;

	}
}

function pointerMove(event)
{
	if( state.drag ) {

		let x = Math.floor((event.clientX - panstate.mx) * (60.0 * activeRange.timeRangeHours / panstate.g.width));

		if( x ) {

			if( x < 0 ) {
				let t0 = moment(panstate.tc).add(-x, "minutes");
				let t1 = moment(t0).add(activeRange.timeRangeHours, "hour");
				startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
				endTime = t1.format("YYYY-MM-DDTHH:mm:ss");			
			} else if( x > 0 ) {
				let t0 = moment(panstate.tc).subtract(x, "minutes");
				let t1 = moment(t0).add(activeRange.timeRangeHours, "hour");
				startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
				endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
			}

			if( !state.loading )
				updateHistory();
			else
				updateAxes();

		}
	}
}

function pointerUp(event)
{
	if( state.drag ) {

		state.drag = false;
		state.updateCanvas = null;

		panstate.g.chart.options.tooltips.enabled = true;
		panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
		panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;

		updateHistory();

	}

	panstate.g = null;
}


// --------------------------------------------------------------------------------------
// HTML generation
// --------------------------------------------------------------------------------------

var _hass = null;
var _this = null;
var contentValid = false;
var iid = 0;

function createContent()
{
	// Initialize the content if it's not there yet.
    if( !contentValid ) {

		contentValid = true;

		ui.darkMode = _hass.selectedTheme && _hass.selectedTheme.dark;

		pconfig.graphLabelColor = ui.darkMode ? '#9b9b9b' : '#333';
		pconfig.graphGridColor  = ui.darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

		graphs = [];

		for( let g of pconfig.graphConfig ) {

			const canvas = _this.querySelector(`#graph${g.id}`);

			let datasets = [];
			for( let d of g.graph.entities ) {
				const name = ( d.name === undefined ) ? _hass.states[d.entity].attributes.friendly_name : d.name;
				const unit = ( d.unit === undefined ) ? _hass.states[d.entity].attributes.unit_of_measurement : d.unit;
				datasets.push({ "name": name, "bColor": d.color, "fillColor": d.fill, "stepped": d.stepped || false, "width": d.width || 2.0, "unit": unit, "entity_id": d.entity });
			}

			const chart = newGraph(canvas, g.graph.type, datasets);

			let w = chart.chartArea.right - chart.chartArea.left;

			graphs.push({ "id": g.id, "type": g.graph.type, "canvas": canvas, "width": w, "chart": chart , "entities": g.graph.entities });

			canvas.addEventListener('pointerdown', pointerDown);
			canvas.addEventListener('pointermove', pointerMove);
			canvas.addEventListener('pointerup', pointerUp);

		}

		/// 
		_this.querySelector('#b1').addEventListener('click', subDay, false);
		_this.querySelector('#b2').addEventListener('click', addDay, false);

		_this.querySelector('#b4').addEventListener('click', decZoom, false);
		_this.querySelector('#b5').addEventListener('click', incZoom, false);
		_this.querySelector('#b3').addEventListener('change', timeRangeSelected);

		ui.dateSelector = _this.querySelector('#bx');
		ui.rangeSelector = _this.querySelector('#b3');

		setTimeRange(4, false);

		startTime = moment().subtract(1, 'day').format('YYYY-MM-DDTHH[:00:00]');
		endTime = moment(startTime).add(activeRange.timeRangeHours, "hour");

		updateHistory();

	}
}

function updateContent()
{
	if( !contentValid ) {
		let width = _this.querySelector('#maincard').clientWidth;
		if( width > 0 ) {
			clearInterval(iid);
			createContent();
			iid = null;
		}
	}
}


// --------------------------------------------------------------------------------------
// Hass API access
// --------------------------------------------------------------------------------------

function callHassAPIGet(url)
{
	return _hass.callApi('GET', url);
}


// --------------------------------------------------------------------------------------
// Get time and date formating strings for a given locale
// --------------------------------------------------------------------------------------

function getLocalizedDateString(locale, style)
{
	let s = new Intl.DateTimeFormat(locale, style).formatToParts(new Date());

	return s.map(part => {
		switch( part.type ) {
			case 'year': return 'YYYY';
			case 'month': return 'MMM';
			case 'day': return 'D';
			case 'hour': return ( s.findIndex((e) => e.type == 'dayPeriod') >= 0 ) ? 'h' : 'HH';
			case 'minute': return 'mm';
			case 'second': return 'ss';
			case 'dayPeriod': return 'a';
			default: return ['.', ',', '/', '-'].includes(part.value) ? ' ' : part.value;
		}
	}).join("");
}


// --------------------------------------------------------------------------------------
// Main card custom HTML element
// --------------------------------------------------------------------------------------

class HistoryExplorerCard extends HTMLElement 
{

	// Whenever the state changes, a new `hass` object is set. Use this to update your content.
	set hass(hass) 
	{
		_this = this;
		_hass = hass;

		let locale = hass.selectedLanguage;
		i18n.styleDateSelector = getLocalizedDateString(locale, { dateStyle: 'medium' });
		i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
		i18n.styleDateTicks = ( i18n.styleDateSelector[0] == 'D' ) ? 'D MMM' : 'MMM D';
		i18n.styleDateTimeTooltip = i18n.styleDateTicks + ', ' + getLocalizedDateString(locale, { timeStyle: 'medium' });

		if( !contentValid && !iid )
			iid = setInterval(updateContent, 100);
	
	}


	// The user supplied configuration. Throw an exception and Lovelace will render an error card.
	setConfig(config) 
	{
//		console.log("----------------------------");
//		console.log(config);

		this.config = config;

		if( !config.graphs || !config.graphs.length ) throw new Error('No graphs defined !');

		pconfig.graphConfig = [];
		for( let i = 0; i < config.graphs.length; i++ ) {
			if( !config.graphs[i].entities || !config.graphs[i].entities.length ) throw new Error('No entities defined for graph !');
			for( let e of config.graphs[i].entities ) {
				if( !e.entity ) throw new Error(`Invalid entity ${e.entity}`);
			}
			pconfig.graphConfig.push({ graph: config.graphs[i], id:i});
		}

		if( config.stateColors ) 
			pconfig.customStateColors = JSON.parse(config.stateColors);
		else
			pconfig.customStateColors = undefined;

		pconfig.enableDataClustering = config.decimation == undefined || config.decimation;

		contentValid = false;

		const header = config.header || "History explorer";

		const bgcol = getComputedStyle(document.body).getPropertyValue('--primary-color') + '1f';

		let html = `
			<ha-card id="maincard" header="${header}">
			<div style="margin-left:0px;width:100%">
				<div style="background-color:${bgcol};margin-left:20px;display:inline-block;padding-left:10px;padding-right:10px;">
					<button id="b1" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
					<button id="bx" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px"></button>
					<button id="b2" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
				</div>
				<div style="background-color:${bgcol};float:right;margin-right:20px;display:inline-block;padding-left:10px;padding-right:10px;">
					<button id="b4" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
					<select id="b3" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">
						<option value="1">1 Hour</option>
						<option value="2">2 Hours</option>
						<option value="6">6 Hours</option>
						<option value="12">12 Hours</option>
						<option value="24">1 Day</option>
						<option value="48">2 Days</option>
						<option value="72">3 Days</option>
						<option value="96">4 Days</option>
						<option value="120">5 Days</option>
						<option value="144">6 Days</option>
						<option value="168">1 Week</option>
					</select>
					<button id="b5" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">+</button>
				</div>
			</div>
			<br>
			<div class='card-content'>
		`;

		for( let g of pconfig.graphConfig ) {
			if( g.id > 0 ) html += '<br>';
			if( g.graph.title !== undefined ) html += `<div style='text-align:center;'>${g.graph.title}</div>`;
			const h = ( g.graph.type == 'line' ) ? 250 : g.graph.entities.length * 50;
			html += `<div sytle='height:${h}px'>`;
			html += `<canvas id="graph${g.id}" width="1300px" height="${h}px" style='touch-action:pan-y'></canvas>`;
			html += `</div>`;
		}

		html += `</div> </ha-card>`;

		this.innerHTML = html;

	}

	// The height of your card. Home Assistant uses this to automatically distribute all cards over the available columns.
	getCardSize() 
	{
		return 3;
	}

}

customElements.define('history-explorer-card', HistoryExplorerCard);

window.customCards = window.customCards || [];
window.customCards.push({ type: 'history-explorer-card', name: 'History Explorer Card', preview: false, description: 'An interactive history viewer card'});
