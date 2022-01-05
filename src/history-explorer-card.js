
import "./moment.min.js";
import "./Chart.js";
import "./timeline.js";

var isMobile = ( navigator.appVersion.indexOf("Mobi") > -1 );

var ui = {};
    ui.dateSelector  = null;
    ui.rangeSelector = null;
    ui.zoomButton    = null;
    ui.darkMode      = false;

var i18n = {};
    i18n.valid                = false;
    i18n.styleDateSelector    = '';
    i18n.styleTimeTicks       = '';
    i18n.styleDateTicks       = '';
    i18n.styleDateTimeTooltip = '';

var pconfig = {};
    pconfig.graphLabelColor      = '#333';
    pconfig.graphGridColor       = '#00000000';
    pconfig.lineGraphHeight      = 250;
    pconfig.customStateColors    = undefined;
    pconfig.graphConfig          = [];
    pconfig.lockAllGraphs        = false;
    pconfig.enableDynamicModify  = true;
    pconfig.enableDataClustering = true;
    pconfig.roundingPrecision    = 2;
    pconfig.nextDefaultColor     = 0;
    pconfig.entities             = [];

var loader = {};
    loader.startTime    = 0;
    loader.endTime      = 0;
    loader.startIndex   = -1;
    loader.endIndex     = -1;

var state = {};
    state.drag          = false;
    state.selecting     = false;
    state.updateCanvas  = null;
    state.loading       = false;
    state.zoomMode      = false;

var activeRange = {};
    activeRange.timeRangeHours  = 24;
    activeRange.tickStepSize    = 1;
    activeRange.dataClusterSize = 0;

var graphs = [];

var g_id = 0;

var startTime;
var endTime;


// --------------------------------------------------------------------------------------
// Default colors for line graphs
// --------------------------------------------------------------------------------------

var defaultColors = [

    { 'color': '#3e95cd', 'fill': 'rgba(151,187,205,0.15)' },
    { 'color': '#95cd3e', 'fill': 'rgba(187,205,151,0.15)' },
    { 'color': '#cd3e3e', 'fill': 'rgba(205,151,151,0.15)' },
    { 'color': '#3ecd95', 'fill': 'rgba(151,205,187,0.15)' },
    { 'color': '#cd953e', 'fill': 'rgba(205,187,151,0.15)' },

];

function getNextDefaultColor()
{
    let i = pconfig.nextDefaultColor++;
    pconfig.nextDefaultColor = pconfig.nextDefaultColor % defaultColors.length;
    return defaultColors[i];
}


// --------------------------------------------------------------------------------------
// Predefined state colors for timeline history
// --------------------------------------------------------------------------------------

var defaultGood = '#66a61e';
var defaultBad = '#b5342d';
var defaultMultiple = '#e5ad23';

var activeRed = '#cd3e3e';
var activeGreen = '#3ecd3e';
var multipleRed = 'rgb(213, 142, 142)';
var multipleGreen = 'rgb(142, 213, 142)';

var stateColors = { 

    // Special states

    'unknown' : "#888888",
    'unavailable' : "#aaaaaa",
    'idle' : "#aaaaaa",

    // on = red , off = inactive (default fallback used for all device classes not explicitely mentioned)

    'on' : activeRed, 
    'off' : '#dddddd',
    'binary_sensor.multiple' : multipleRed,

    // on = green , off = inactive

    'battery_charging.on': activeGreen,
    'battery_charging.multiple': multipleGreen,
    'plug.on': activeGreen,
    'plug.multiple': multipleGreen,
    'running.on': activeGreen,
    'running.multiple': multipleGreen,
    'update.on': activeGreen,
    'update.multiple': multipleGreen,

    // on = good (green), off = bad (red)

    'connectivity.on': defaultGood,
    'connectivity.off': defaultBad,
    'connectivity.multiple': defaultMultiple,
    'power.on': defaultGood,
    'power.off': defaultBad,
    'power.multiple': defaultMultiple,
    'presence.on': defaultGood,
    'presence.off': defaultBad,
    'presence.multiple': defaultMultiple,

    // on = bad (red), off = good (green)

    'gas.on': defaultBad,
    'gas.off': defaultGood,
    'gas.multiple': defaultMultiple,
    'smoke.on': defaultBad,
    'smoke.off': defaultGood,
    'smoke.multiple': defaultMultiple,
    'problem.on': defaultBad,
    'problem.off': defaultGood,
    'problem.multiple': defaultMultiple,
    'safety.on': defaultBad,
    'safety.off': defaultGood,
    'safety.multiple': defaultMultiple,

    // person domain

    'person.home' : '#66a61e',
    'person.not_home' : '#b5342d',
    'person.arriving' : '#d5bd43',
    'person.leaving' : '#d5bd43',
    'person.multiple' : '#e5ad23',

    // weather domain

    'weather.cloudy' : '#91acce',
    'weather.fog' : '#adadad',
    'weather.rainy' : '#5285df',
    'weather.partlycloudy' : '#11a3e9',
    'weather.sunny' : '#e9db11',
    'weather.multiple' : '#aaaaaa',

    // automation domain

    'automation.on': activeGreen,
    'automation.multiple': multipleGreen,

    // 

    'input_select.Eco' : '#44739e', 
    'input_select.Confort - 2' : '#984ea3', 
    'input_select.Confort - 1' : '#00d2d5', 
    'input_select.Confort' : '#ff7f00',

    // 

    'sensor.WCDMA' : '#44739e', 
    'sensor.LTE' : '#984ea3',

};

var stateColorsDark = { 

    'off' : "#383838", 

};

function getStateColor(domain, device_class, value)
{
    let c;

    // device_class.state override
    if( device_class ) {
        const v = device_class + '.' + value;
        c = pconfig.customStateColors?.[v];
        c = c ?? (( ui.darkMode && stateColorsDark[v] ) ? stateColorsDark[v] : stateColors[v]);
    }

    // domain.state override
    if( !c && domain ) {
        const v = domain + '.' + value;
        c = pconfig.customStateColors?.[v];
        c = c ?? (( ui.darkMode && stateColorsDark[v] ) ? stateColorsDark[v] : stateColors[v]);
    }

    // global state override
    if( !c ) {
        c = pconfig.customStateColors?.[value];
        c = c ?? (( ui.darkMode && stateColorsDark[value] ) ? stateColorsDark[value] : stateColors[value]);
    }

    // general fallback if state color is not defined anywhere
    c = c ?? (ui.darkMode ? "#777777" : "#dddddd");

    return c;
}


// --------------------------------------------------------------------------------------
// UI element handlers
// --------------------------------------------------------------------------------------

function today()
{
    if( !state.loading ) {

        if( activeRange.timeRangeHours < 24 ) setTimeRange(24, false);

        endTime = moment().add(1, 'hour').format('YYYY-MM-DDTHH[:00:00]');
        startTime = moment(endTime).subtract(activeRange.timeRangeHours, "hour");

        updateHistory();

    }
}

function subDay()
{
    if( !state.loading ) {

        if( activeRange.timeRangeHours < 24 ) setTimeRange(24, false);

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

        if( activeRange.timeRangeHours < 24 ) setTimeRange(24, false);

        let t0 = moment(startTime).add(1, "day");
        let t1 = moment(t0).add(activeRange.timeRangeHours, "hour");
        startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
        endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

        updateHistory();

    }
}

function toggleZoom()
{
    state.zoomMode = !state.zoomMode;
    ui.zoomButton.style.backgroundColor = state.zoomMode ? ui.darkMode ? '#ffffff3a' : '#0000003a' : '#0000';

    if( panstate.overlay ) {
        panstate.overlay.remove();
        panstate.overlay = null;
    }
}

function decZoom()
{
    const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168];
       
    let i = ranges.findIndex(e => e >= activeRange.timeRangeHours);
    if( i >= 0 ) {
        if( ranges[i] > activeRange.timeRangeHours ) i--;
        if( i < ranges.length-1 ) 
            setTimeRange(ranges[i+1], true);
    }
}

function incZoom()
{
    const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168];
    const i = ranges.findIndex(e => e >= activeRange.timeRangeHours);
    if( i > 0 ) 
        setTimeRange(ranges[i-1], true);
}

function timeRangeSelected(event)
{
    setTimeRange(event.target.value, true);
}

function setTimeRange(range, update, t_center = null)
{
    if( state.loading ) return;

    const stepSizes = { '1': 5, '2': 10, '3': 15, '4': 30, '5': 30, '6': 30, '7': 30, '8': 30, '9': 30, '10': 60, '11': 60, '12':60, '24': 2, '48': 2, '72': 6, '96': 6, '120':12, '144':12, '168':24 };

    activeRange.tickStepSize = stepSizes[range];

    const dataClusterSizes = { '48': 2, '72': 5, '96': 10, '120': 30, '144': 30, '168': 60 };
    const minute = 60000;

    activeRange.dataClusterSize = ( range >= 48 ) ? dataClusterSizes[range] * minute : 0;

    if( !pconfig.enableDataClustering ) activeRange.dataClusterSize = 0;

    activeRange.timeRangeHours = range;
    ui.rangeSelector.value = range;

    for( let g of graphs ) {
        g.chart.options.scales.xAxes[0].time.unit = ( activeRange.timeRangeHours < 24 ) ? 'minute' : 'hour';
        g.chart.options.scales.xAxes[0].time.stepSize = activeRange.tickStepSize;
        g.chart.update();
    }

    if( update ) {

        if( t_center ) {

            let t1 = moment(t_center).add(activeRange.timeRangeHours / 2, "hour");
            let t0 = moment(t1).subtract(activeRange.timeRangeHours, "hour");
            startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

        } else if( activeRange.timeRangeHours > 24 ) {

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

function findCacheEntityIndex(c_id, entity)
{
    if( !cache[c_id].valid ) return -1;

    for( let i = 0; i < cache[c_id].entities.length; i++ ) {
        if( cache[c_id].entities[i] == entity ) return i;
    }

    return -1;
}

function generateGraphDataFromCache()
{
    let c0 = mapStartTimeToCacheSlot(startTime);
    let c1 = mapEndTimeToCacheSlot(endTime);

    if( c0 >= 0 && c1 >= 0 ) {

        //console.log(`merge from ${c0} to ${c1}`);

        // Build partial data
        // The result data for the charts is expected in order of the charts entities, but the cache might not hold data 
        // for all the entities or it might be in a different order. So for every chart entity, search the cache for a match.
        // If no match found, then add en empty record into the result, so to keep the indices in sync for buildChartData().
        let result = [];
        for( let i = c0; i <= c1; i++ ) {
            let j = 0;
            for( let g of graphs ) {
                for( let e of g.entities ) {
                if( result[j] == undefined ) result[j] = [];
                    const k = findCacheEntityIndex(i, e.entity);
                    if( k >= 0 ) 
                        result[j] = result[j].concat(cache[i].data[k]);
                    j++;
                }
            }
        }

        // Add the very last state from the cache slot just before the requested one, if possible.
        // This is to ensure that the charts have one data point just before the start of their own data
        // This avoids interpolation issues at the chart start and disappearing states at the beginning of timelines.
        if( c0 > 0 && cache[c0-1].valid ) {
            let j = 0;
            for( let g of graphs ) {
                for( let e of g.entities ) {
                    const k = findCacheEntityIndex(c0-1, e.entity);
                    if( k >= 0 ) {
                        let n = cache[c0-1].data[k].length;
                        if( n > 0 ) 
                            result[j].unshift({ "last_changed": cache[c0].start, "state": cache[c0-1].data[k][n-1].state });
                    }
                    j++;
                }
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
    //console.log("database retrieval OK");
    //console.log(result);

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

    // Update the list of entities present in the cache slots (the data is in that order)
    for( let i = loader.startIndex; i <= loader.endIndex; i++ ) {
        cache[i].entities = [];
        for( let j of result ) {
            cache[i].entities.push(j[0].entity_id);
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

                    const enableClustering = g.entities[j].decimation == undefined || g.entities[j].decimation;

                    if( enableClustering && activeRange.dataClusterSize > 0 ) {

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

                    if( m_now > m_end && s.length > 0 && moment(s[s.length-1].x) < m_end ) {
                        s.push({ x: m_end, y: result[id][n-1].state});
                    } else if( m_now <= m_end && s.length > 0 && moment(s[s.length-1].x) < m_now ) {
                        s.push({ x: m_now, y: result[id][n-1].state});
                    }

                } else if( g.type == 'timeline' ) {				

                    // Fill timeline chart buffer

                    const enableClustering = g.entities[j].decimation == undefined || g.entities[j].decimation;

                    let merged = 0;
                    let mt0, mt1;
                    let state;

                    const m_max = ( m_now < m_end ) ? m_now : m_end;

                    for( let i = 0; i < n; i++ ) {

                        // Start and end timecode of current state block
                        let t0 = result[id][i].last_changed;
                        let t1 = ( i < n-1 ) ? result[id][i+1].last_changed : m_max;

                        // Not currently merging small blocks ?
                        if( !merged ) {

                            // State of the current block
                            state = result[id][i].state;

                            // Skip noop state changes (can happen at cache slot boundaries)
                            while( i < n-1 && result[id][i].state == result[id][i+1].state ) {
                                ++i;
                                t1 = ( i < n-1 ) ? result[id][i+1].last_changed : m_max;
                            }

                        }

                        if( !enableClustering || moment(t1).diff(moment(t0)) >= activeRange.dataClusterSize ) {
                            // Larger than merge limit, finish a potential current merge before proceeding with new block
                            if( merged > 0 ) {
                                t0 = mt0;
                                t1 = mt1;
                                i--;
                            }
                        } else {
                            // Below merge limit, start merge (keep the first state for possible single block merges) or extend current one
                            if( !merged ) { mt0 = t0; state = result[id][i].state; }
                            mt1 = t1;
                            merged++;
                            continue;
                        }

                        // Add the current block to the graph
                        if( moment(t1) >= m_start ) {
                            if( moment(t1) > m_end ) t1 = endTime;
                            if( moment(t0) > m_end ) break;
                            if( moment(t0) < m_start ) t0 = startTime;
                            var e = [];
                            e.push(t0);
                            e.push(t1);
                            e.push(( merged > 1 ) ? 'multiple' : state);
                            s.push(e);
                        }

                        // Merging always stops when a block was added
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
                domain: d.domain,
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
            datastructure.datasets.push({ 
                domain: d.domain,
                device_class: d.device_class,
                entity_id: d.entity_id,
                data: [ ] 
            });
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
                            const p = 10 ** pconfig.roundingPrecision;
                            label += Math.round(item.yLabel * p) / p;
                            label += ' ' + data.datasets[item.datasetIndex].unit || '';
                            return label;
                        } else {
                            const d = data.datasets[item.datasetIndex].data[item.index];
                            return [d[2], moment(d[0]).format(i18n.styleDateTimeTooltip), moment(d[1]).format(i18n.styleDateTimeTooltip)];
                        }
                    }
                },
                yAlign: ( graphtype == 'line' ) ? undefined : 'nocenter',
                caretPadding: 8
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
                colorFunction: function(text, data, datasets, index) {
                    // * check device_class.state first (if it exists)
                    // * if not found, then check domain.state
                    // * if not found, check global state
                    return getStateColor(datasets[index].domain, datasets[index].device_class, data[2]);
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

    //console.log(`Slots ${c0} to ${c1}`);

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
        //console.log(url);

        const p = callHassAPIGet(url);
        p.then(loaderCallback, loaderFailed);

    } else

        // All needed slots already in the cache, generate the chart data
        generateGraphDataFromCache();
}

function updateHistoryWithClearCache()
{
    if( !state.loading ) {
        cache.length = 0;
        updateHistory();
    }
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
    panstate.overlay = null;
    panstate.st0 = null;
    panstate.st1 = null;

function PixelPositionToTimecode(x)
{
    const f = (x - panstate.g.chart.chartArea.left) / (panstate.g.chart.chartArea.right - panstate.g.chart.chartArea.left);

    return moment(startTime) + moment(endTime).diff(startTime) * f;
}

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

        panstate.mx = event.clientX;

        event.target?.setPointerCapture(event.pointerId);

        if( !state.zoomMode ) {            

            state.drag = true;

            panstate.tc = startTime;

            state.updateCanvas = pconfig.lockAllGraphs ? null : event.target;

        } else {

            const x0 = panstate.mx - panstate.g.canvas.getBoundingClientRect().left;

            if( x0 > panstate.g.chart.chartArea.left && x0 < panstate.g.chart.chartArea.right ) {

                if( !panstate.overlay ) {

                    let e = document.createElement('canvas');
                    e.style = 'position:absolute;pointer-events:none;';
                    e.width = panstate.g.canvas.width;
                    e.height = panstate.g.canvas.height;

                    panstate.g.canvas.parentNode.insertBefore(e, panstate.g.canvas);

                    panstate.overlay = e;

                }

                panstate.st0 = PixelPositionToTimecode(x0);

                state.selecting = true;

            }

        }

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

    } else if( state.selecting && panstate.overlay ) {

        let ctx = panstate.overlay.getContext('2d');
        ctx.clearRect(0, 0, panstate.overlay.width, panstate.overlay.height);

        const rect = panstate.overlay.getBoundingClientRect();
        const x0 = panstate.mx - rect.left;
        const x1 = Math.max(Math.min(event.clientX - rect.left, panstate.g.chart.chartArea.right), panstate.g.chart.chartArea.left);        

        ctx.fillStyle = ui.darkMode ? '#ffffff20' : '#00000020';
        ctx.fillRect(x0, panstate.g.chart.chartArea.top, x1-x0, panstate.g.chart.chartArea.bottom - panstate.g.chart.chartArea.top);

        panstate.st1 = PixelPositionToTimecode(x1);

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

    if( state.selecting ) {

        state.selecting = false;

        panstate.g.chart.options.tooltips.enabled = true;

        panstate.overlay.remove();
        panstate.overlay = null;

        if( panstate.st1 < panstate.st0 ) [panstate.st1, panstate.st0] = [panstate.st0, panstate.st1];

        const tm = (moment(panstate.st1) + moment(panstate.st0)) / 2;

        let d = Math.ceil(moment.duration(panstate.st1 - panstate.st0).asMinutes() / 60.0);
        
        if( d < 12 ) {

            if( d < 1 ) d = 1;

            setTimeRange(d, true, tm);

        } else {

            d = Math.ceil(d / 24.0);

            if( d < 1 ) setTimeRange(12, true, tm); else
            if( d < 2 ) setTimeRange(24, true, tm); else
            if( d < 3 ) setTimeRange(48, true, tm); else
            if( d < 4 ) setTimeRange(72, true, tm); else
            if( d < 5 ) setTimeRange(96, true, tm); else
            if( d < 6 ) setTimeRange(120, true, tm); else
            if( d < 7 ) setTimeRange(144, true, tm); else setTimeRange(189, true, tm);

        }

        toggleZoom();

    }

    panstate.g = null;
}

function pointerCancel(event)
{
    if( state.drag ) {

        state.drag = false;
        state.updateCanvas = null;

        panstate.g.chart.options.tooltips.enabled = true;
        panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
        panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;

    }

    if( state.selecting ) {

        state.selecting = false;

        panstate.g.chart.options.tooltips.enabled = true;

        panstate.overlay.remove();
        panstate.overlay = null;

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

function getDomainForEntity(entity)
{
    return entity.substr(0, entity.indexOf("."));
}

function getDeviceClass(entity)
{
    return _hass.states[entity]?.attributes?.device_class;
}

function removeGraph(event)
{
    const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

    for( let i = 0; i < graphs.length; i++ ) {
        if( graphs[i].id == id ) {
            graphs[i].canvas.parentNode.remove();
            for( let e of graphs[i].entities ) {
                const j = pconfig.entities.indexOf(e.entity);
                if( j >= 0 ) pconfig.entities.splice(j, 1);
            }
            graphs.splice(i, 1);
            break;
        }
    }

    updateHistoryWithClearCache();

    window.localStorage.removeItem('history-explorer-card');
    window.localStorage.setItem('history-explorer-card', JSON.stringify(pconfig.entities));
}

function addEntitySelected(event)
{
    if( state.loading ) return;

    let inputfield =_this.querySelector('#b7'); 

    const entity_id = inputfield.value;
    inputfield.value = "";

    if( _hass.states[entity_id] == undefined ) {
        // TODO: let the user know
        return;
    }

    addEntityGraph(entity_id);

    updateHistoryWithClearCache();

    pconfig.entities.push(entity_id);
    window.localStorage.setItem('history-explorer-card', JSON.stringify(pconfig.entities));
}

function addEntityGraph(entity_id)
{
    if( _hass.states[entity_id] == undefined ) return;

    const type = ( _hass.states[entity_id].attributes?.unit_of_measurement == undefined ) ? 'timeline' : 'line';

    let entities = [{ "entity": entity_id, "color": "#000000", "fill": "#00000000" }];

    if( type == 'line' ) {
        const c = getNextDefaultColor();
        entities[0].color = c.color;
        entities[0].fill = c.fill;
    }

    // Add to an existing timeline graph if possible (if it's the last in the list)
    if( type == 'timeline' && graphs.length > 0 && graphs[graphs.length-1].type == 'timeline' ) {

        // Add the new entity to the previous ones
        entities = graphs[graphs.length-1].entities.concat(entities);

        // Delete the old graph, will be regenerated below including the new entity
        graphs[graphs.length-1].canvas.parentNode.remove();
        graphs.length--;

    }

    const h = ( type == 'line' ) ? pconfig.lineGraphHeight : Math.max(entities.length * 45, 130);

    let html = '';
    html += `<div sytle='height:${h}px'>`;
    html += `<canvas id="graph${g_id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
    html += `<button id='bc-${g_id}' style="position:absolute;right:20px;margin-top:${-h+5}px;">x</button>`;
    html += `</div>`;

    let e = document.createElement('div');
    e.innerHTML = html;

    let gl = _this.querySelector('#graphlist');
    gl.appendChild(e);

    _this.querySelector(`#bc-${g_id}`).addEventListener('click', removeGraph);

    addGraphToCanvas(g_id++, type, entities);
}

function addGraphToCanvas(gid, type, entities)
{
    const canvas = _this.querySelector(`#graph${gid}`);

    let datasets = [];
    for( let d of entities ) {
        datasets.push({
            "name": ( d.name === undefined ) ? _hass.states[d.entity].attributes.friendly_name : d.name,
            "bColor": d.color, 
            "fillColor": d.fill, 
            "stepped": d.stepped || false, 
            "width": d.width || 2.0,
            "unit": ( d.unit === undefined ) ? _hass.states[d.entity].attributes.unit_of_measurement : d.unit,
            "domain": getDomainForEntity(d.entity),
            "device_class": getDeviceClass(d.entity),
            "entity_id" : d.entity
        });
    }

    const chart = newGraph(canvas, type, datasets);

    let w = chart.chartArea.right - chart.chartArea.left;

    graphs.push({ "id": gid, "type": type, "canvas": canvas, "width": w, "chart": chart , "entities": entities });

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
}

function createContent()
{
    // Initialize the content if it's not there yet.
    if( !contentValid ) {

        contentValid = true;

        ui.darkMode = _hass.selectedTheme && _hass.selectedTheme.dark;
        if( _this.config.uimode ) {
            if( _this.config.uimode === 'dark' ) ui.darkMode = true; else
            if( _this.config.uimode === 'light' ) ui.darkMode = false;
        }

        pconfig.graphLabelColor = ui.darkMode ? '#9b9b9b' : '#333';
        pconfig.graphGridColor  = ui.darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

        graphs = [];

        for( let g of pconfig.graphConfig ) {
            addGraphToCanvas(g.id, g.graph.type, g.graph.entities);
        }

        /// 
        _this.querySelector('#b1').addEventListener('click', subDay, false);
        _this.querySelector('#b2').addEventListener('click', addDay, false);
        _this.querySelector('#bx').addEventListener('click', today, false);

        _this.querySelector('#bz').addEventListener('click', toggleZoom, false);
        _this.querySelector('#b4').addEventListener('click', decZoom, false);
        _this.querySelector('#b5').addEventListener('click', incZoom, false);
        _this.querySelector('#b3').addEventListener('change', timeRangeSelected);

        ui.dateSelector = _this.querySelector('#bx');
        ui.rangeSelector = _this.querySelector('#b3');
        ui.zoomButton = _this.querySelector('#bz');

        if( pconfig.enableDynamicModify ) {

            _this.querySelector('#b8').addEventListener('click', addEntitySelected);

            let datalist = _this.querySelector('#b6');

            for( let e in _hass.states ) {
                const domain = e.substr(0, e.indexOf("."));
                let o = document.createElement('option');
                o.innerHTML = e;
                datalist.appendChild(o);
            }

            pconfig.entities = JSON.parse(window.localStorage.getItem('history-explorer-card'));
            
            if( pconfig.entities ) {
                for( let e of pconfig.entities ) addEntityGraph(e);
            } else
                pconfig.entities = [];

        }

        today();

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

        if( !i18n.valid ) {

            let locale = hass.language ? hass.language : 'en-GB';
            i18n.styleDateSelector = getLocalizedDateString(locale, { dateStyle: 'medium' });
            i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
            i18n.styleDateTicks = ( i18n.styleDateSelector[0] == 'D' ) ? 'D MMM' : 'MMM D';
            i18n.styleDateTimeTooltip = i18n.styleDateTicks + ', ' + getLocalizedDateString(locale, { timeStyle: 'medium' });

            i18n.valid = true;

        }

        if( !contentValid && !iid )
            iid = setInterval(updateContent, 100);

    }


    // The user supplied configuration. Throw an exception and Lovelace will render an error card.
    setConfig(config) 
    {
        this.config = config;

        g_id = 0;

        pconfig.graphConfig = [];

        if( config.graphs ) {
            for( let i = 0; i < config.graphs.length; i++ ) {
                for( let e of config.graphs[i].entities ) {
                    if( !e.entity ) throw new Error(`Invalid entity ${e.entity}`);
                }
                pconfig.graphConfig.push({ graph: config.graphs[i], id:g_id++ });
            }
        }

        pconfig.customStateColors = config.stateColors;
        pconfig.enableDataClustering = ( config.decimation == undefined ) || config.decimation;
        pconfig.roundingPrecision = config.rounding || 2;

        contentValid = false;

        const header = config.header || "History explorer";

        const bgcol = getComputedStyle(document.body).getPropertyValue('--primary-color') + '1f';

        const optionStyle = `style="color:var(--primary-text-color);background-color:var(--paper-listbox-background-color)"`;

        let html = `
            <ha-card id="maincard" header="${header}">
            <div style="margin-left:0px;width:100%">
                <div style="background-color:${bgcol};margin-left:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                    <button id="b1" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
                    <button id="bx" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px"></button>
                    <button id="b2" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
                </div>
                <div style="background-color:${bgcol};float:right;margin-right:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                    <button id="bz" style="border:0px solid black;color:inherit;background-color:#00000000"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" /></svg></button>
                    <button id="b4" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                    <select id="b3" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">
                        <option value="1" ${optionStyle}>1 H</option>
                        <option value="2" ${optionStyle}>2 H</option>
                        <option value="3" ${optionStyle} hidden>3 H</option>
                        <option value="4" ${optionStyle} hidden>4 H</option>
                        <option value="5" ${optionStyle} hidden>5 H</option>
                        <option value="6" ${optionStyle}>6 H</option>
                        <option value="7" ${optionStyle} hidden>7 H</option>
                        <option value="8" ${optionStyle} hidden>8 H</option>
                        <option value="9" ${optionStyle} hidden>9 H</option>
                        <option value="10" ${optionStyle} hidden>10 H</option>
                        <option value="11" ${optionStyle} hidden>11 H</option>
                        <option value="12" ${optionStyle}>12 H</option>
                        <option value="24" ${optionStyle}>1 Day</option>
                        <option value="48" ${optionStyle}>2 Days</option>
                        <option value="72" ${optionStyle}>3 Days</option>
                        <option value="96" ${optionStyle}>4 Days</option>
                        <option value="120" ${optionStyle}>5 Days</option>
                        <option value="144" ${optionStyle}>6 Days</option>
                        <option value="168" ${optionStyle}>1 Week</option>
                    </select>
                    <button id="b5" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">+</button>
                </div>
            </div>
            <br>
            <div id='graphlist' class='card-content'>
        `;

        for( let g of pconfig.graphConfig ) {
            if( g.id > 0 ) html += '<br>';
            if( g.graph.title !== undefined ) html += `<div style='text-align:center;'>${g.graph.title}</div>`;
            const h = ( g.graph.type == 'line' ) ? pconfig.lineGraphHeight : Math.max(g.graph.entities.length * 45, 130);
            html += `<div sytle='height:${h}px'>`;
            html += `<canvas id="graph${g.id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
            html += `</div>`;
        }

        if( pconfig.enableDynamicModify ) {
            html += 
                `</div> 
                <div style="background-color:${bgcol};margin-left:20px;display:inline-block;padding-left:10px;padding-right:10px;">
                    <datalist id="b6"></datalist>
                    <input id="b7" autoComplete="on" list="b6" size=40 placeholder="Type to search for an entity to add"/>
                    <button id="b8" style="border:0px solid black;color:inherit;background-color:#00000000;height:34px;margin-left:5px;">+</button>
                </div>
                <br><br>
                </ha-card>
            `;
        }

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
