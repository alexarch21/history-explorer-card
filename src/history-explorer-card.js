
import "./deps/moment.min.js";
import "./deps/Chart.js";
import "./deps/timeline.js";
import "./deps/md5.min.js"
import "./deps/FileSaver.js"

const Version = '1.0.34';

var isMobile = ( navigator.appVersion.indexOf("Mobi") > -1 ) || ( navigator.userAgent.indexOf("HomeAssistant") > -1 );


// --------------------------------------------------------------------------------------
// Valid time ranges in hours
// --------------------------------------------------------------------------------------

const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 720, 2184, 4368];


// --------------------------------------------------------------------------------------
// Maximum size of data cache in days
// --------------------------------------------------------------------------------------

const cacheSize = 300;


// --------------------------------------------------------------------------------------
// Shared panning state
// --------------------------------------------------------------------------------------

var panstate = {};
    panstate.mx = 0;
    panstate.lx = 0;
    panstate.tc = 0;
    panstate.g 	= null;
    panstate.overlay = null;
    panstate.st0 = null;
    panstate.st1 = null;


// --------------------------------------------------------------------------------------
// HA entity history info panel enabled flag
// --------------------------------------------------------------------------------------

let infoPanelEnabled = !!JSON.parse(window.localStorage.getItem('history-explorer-info-panel'));


// --------------------------------------------------------------------------------------
// Internal card representation and instance state
// --------------------------------------------------------------------------------------

class HistoryCardState {

    constructor() 
    {

        this.colorMap = new Map();
        this.timeCache = new Map();
        this.stateTexts = new Map();

        this.csvExporter = new HistoryCSVExporter();
        this.statsExporter = new StatisticsCSVExporter();

        this.ui = {};
        this.ui.dateSelector  = [];
        this.ui.rangeSelector = [];
        this.ui.zoomButton    = [];
        this.ui.inputField    = [];
        this.ui.darkMode      = false;
        this.ui.spinOverlay   = null;
        this.ui.optionStyle   = '';
        this.ui.hideHeader    = false;
        this.ui.stickyTools   = 0;

        this.i18n = {};
        this.i18n.valid                = false;
        this.i18n.styleDateSelector    = '';
        this.i18n.styleTimeTicks       = '';
        this.i18n.styleDateTicks       = '';
        this.i18n.styleDateTimeTooltip = '';

        this.pconfig = {};
        this.pconfig.graphLabelColor      = '#333';
        this.pconfig.graphGridColor       = '#00000000';
        this.pconfig.lineGraphHeight      = 250;
        this.pconfig.barGraphHeight       = 150;
        this.pconfig.labelAreaWidth       = 65;
        this.pconfig.labelsVisible        = true;
        this.pconfig.showTooltipColors    = [true, true];
        this.pconfig.tooltipSize          = 'auto';
        this.pconfig.tooltipShowDuration  = false;
        this.pconfig.closeButtonColor     = undefined;
        this.pconfig.customStateColors    = undefined;
        this.pconfig.colorSeed            = 137;
        this.pconfig.graphConfig          = [];
        this.pconfig.entityOptions        = undefined;
        this.pconfig.lockAllGraphs        = false;
        this.pconfig.combineSameUnits     = false;
        this.pconfig.recordedEntitiesOnly = false;
        this.pconfig.filterEntities       = undefined;
        this.pconfig.enableDataClustering = true;
        this.pconfig.roundingPrecision    = 2;
        this.pconfig.defaultLineMode      = undefined;
        this.pconfig.nextDefaultColor     = 0;
        this.pconfig.showUnavailable      = true;
        this.pconfig.axisAddMarginMin     = true;
        this.pconfig.axisAddMarginMax     = true;
        this.pconfig.defaultTimeRange     = '24';
        this.pconfig.timeTickDensity      = 'high';
        this.pconfig.exportSeparator      = undefined;
        this.pconfig.exportTimeFormat     = undefined;
        this.pconfig.entities             = [];
        this.pconfig.infoPanelConfig      = null;

        this.loader = {};
        this.loader.startTime    = 0;
        this.loader.endTime      = 0;
        this.loader.startIndex   = -1;
        this.loader.endIndex     = -1;
        this.loader.loadingStats = false;

        this.state = {};
        this.state.drag          = false;
        this.state.selecting     = false;
        this.state.updateCanvas  = null;
        this.state.loading       = false;
        this.state.zoomMode      = false;

        this.activeRange = {};
        this.activeRange.timeRangeHours  = 24;
        this.activeRange.timeRangeMinutes= 0;
        this.activeRange.tickStepSize    = 1;
        this.activeRange.tickStepUnit    = 'hour';
        this.activeRange.dataClusterSize = 0;

        this.statistics = {};
        this.statistics.enabled = false;
        this.statistics.retention = undefined;
        this.statistics.mode = '';

        this.id = "";

        this.graphs = [];

        this.g_id = 0;
        this.firstDynamicId = 0;

        this.startTime;
        this.endTime;

        this.limitSlot = 0;

        this.cache = [];

        this._hass = null;
        this._this = null;
        this.contentValid = false;
        this.entitiesPopulated = false;
        this.iid = 0;
        this.lastWidth = 0;

        this.defocusCall = this.entitySelectorDefocus.bind(this);

        this.databaseCallback = null;

    }


    // --------------------------------------------------------------------------------------
    // Color queries
    // --------------------------------------------------------------------------------------

    getNextDefaultColor()
    {
        let i = this.pconfig.nextDefaultColor++;
        this.pconfig.nextDefaultColor = this.pconfig.nextDefaultColor % defaultColors.length;
        return defaultColors[i];
    }

    getStateColor(domain, device_class, entity_id, value)
    {
        let c;

        if( value === undefined || value === null || value === '' ) value = 'unknown';

        // entity_id.state override
        if( entity_id ) {
            const v = entity_id + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[entity_id];
        }

        // device_class.state override
        if( !c && device_class ) {
            const v = device_class + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[device_class];
        }

        // domain.state override
        if( !c && domain ) {
            const v = domain + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[domain];
        }

        // global state override
        if( !c ) {
            c = this.pconfig.customStateColors?.[value];
        }

        // device_class.state defaults
        if( !c && device_class ) {
            const v = device_class + '.' + value;
            c = (( this.ui.darkMode && stateColorsDark[v] ) ? stateColorsDark[v] : stateColors[v]);
        }

        // domain.state defaults
        if( !c && domain ) {
            const v = domain + '.' + value;
            c = (( this.ui.darkMode && stateColorsDark[v] ) ? stateColorsDark[v] : stateColors[v]);
        }

        // global state defaults
        if( !c ) {
            c = (( this.ui.darkMode && stateColorsDark[value] ) ? stateColorsDark[value] : stateColors[value]);
        }

        // general fallback if state color is not defined anywhere, generate color from the MD5 hash of the state name
        if( !c ) {
            if( !this.colorMap.has(value) ) {
                const md = md5hx(value);
                const h = ((md[0] & 0x7FFFFFFF) * this.pconfig.colorSeed) % 359;
                const s = Math.ceil(45.0 + (30.0 * (((md[1] & 0x7FFFFFFF) % 255) / 255.0))) - (this.ui.darkMode ? 13 : 0);
                const l = Math.ceil(55.0 + (10.0 * (((md[1] & 0x7FFFFFFF) % 255) / 255.0))) - (this.ui.darkMode ? 5 : 0);
                c = 'hsl(' + h +',' + s + '%,' + l + '%)';
                this.colorMap.set(value, c);
            } else
               c = this.colorMap.get(value);
        }

        return c;
    }


    // --------------------------------------------------------------------------------------
    // Device class or domain specific state localization
    // --------------------------------------------------------------------------------------

    getLocalizedState(state, domain, device_class, entity)
    {
        const s = entity + state;

        let v = this.stateTexts.get(s);
        if( !v ) {
            v = ( device_class && this._hass.localize(`component.${domain}.state.${device_class}.${state}`) ) || 
                  this._hass.localize(`component.${domain}.state._.${state}`) || state;
            this.stateTexts.set(s, v);
        }
        
        return v;
    }


    // --------------------------------------------------------------------------------------
    // UI element handlers
    // --------------------------------------------------------------------------------------

    today(resetRange = false)
    {
        if( !this.state.loading ) {

            if( resetRange ) this.setTimeRange(24, false);

            this.endTime = moment().format('YYYY-MM-DDTHH:mm[:00]');
            this.startTime = moment(this.endTime).subtract(this.activeRange.timeRangeHours, "hour").subtract(this.activeRange.timeRangeMinutes, "minute").format('YYYY-MM-DDTHH:mm[:00]');

            this.updateHistory();

        }
    }

    todayNoReset()
    {
        this.today(false);
    }    

    todayReset()
    {
        this.today(true);
    }

    subDay()
    {
        if( !this.state.loading ) {

            if( this.activeRange.timeRangeHours < 24 ) this.setTimeRange(24, false);

            let t0 = moment(this.startTime).subtract(1, "day");
            let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
            this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
            this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

            this.updateHistory();

        }
    }

    addDay()
    {
        if( !this.state.loading ) {

            if( this.activeRange.timeRangeHours < 24 ) this.setTimeRange(24, false);

            let t0 = moment(this.startTime).add(1, "day");
            let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
            this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
            this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

            this.updateHistory();

        }
    }

    toggleZoom()
    {
        this.state.zoomMode = !this.state.zoomMode;

        for( let i of this.ui.zoomButton )
            if( i ) i.style.backgroundColor = this.state.zoomMode ? this.ui.darkMode ? '#ffffff3a' : '#0000003a' : '#0000';

        if( panstate.overlay ) {
            panstate.overlay.remove();
            panstate.overlay = null;
        }
    }

    decZoom()
    {
        this.decZoomStep();
    }

    incZoom()
    {
        this.incZoomStep();
    }

    timeRangeSelected(event)
    {
        this.setTimeRange(event.target.value, true);
    }

    exportFile()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.csvExporter.exportFile(this);
    }

    exportStatistics()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.statsExporter.exportFile(this);
    }

    toggleInfoPanel()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        if( confirm(infoPanelEnabled ? i18n('ui.popup.disable_panel') : i18n('ui.popup.enable_panel')) ) {
            infoPanelEnabled = !infoPanelEnabled;
            this.writeInfoPanelConfig(true);
            location.reload();
        }
    }


    // --------------------------------------------------------------------------------------
    // Stepped zooming
    // --------------------------------------------------------------------------------------

    decZoomStep(t_center = null, t_position = 0.5)
    {
        if( !this.activeRange.timeRangeHours ) {
            this.activeRange.timeRangeMinutes *= 2;
            if( this.activeRange.timeRangeMinutes >= 60 ) {
                this.activeRange.timeRangeMinutes = 0;
                this.activeRange.timeRangeHours = 0;
            }
        }

        if( !this.activeRange.timeRangeMinutes ) {
               
            let i = ranges.findIndex(e => e >= this.activeRange.timeRangeHours);
            if( i >= 0 ) {
                if( ranges[i] > this.activeRange.timeRangeHours ) i--;
                if( i < ranges.length-1 ) 
                    this.setTimeRange(ranges[i+1], true, t_center, t_position);
            }

        } else

            this.setTimeRangeMinutes(this.activeRange.timeRangeMinutes, true, t_center, t_position);
    }

    incZoomStep(t_center = null, t_position = 0.5)
    {
        const i = ranges.findIndex(e => e >= this.activeRange.timeRangeHours);
        if( i > 0 ) 
            this.setTimeRange(ranges[i-1], true, t_center, t_position);
        else
            this.setTimeRangeMinutes((this.activeRange.timeRangeHours * 60 + this.activeRange.timeRangeMinutes) / 2, true, t_center, t_position);
    }


    // --------------------------------------------------------------------------------------
    // Display interval for accumulating bar graphs
    // --------------------------------------------------------------------------------------

    selectBarInterval(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {
                this.graphs[i].interval = event.target.value;
                break;
            }
        }

        this.updateHistory();
    }

    createIntervalSelectorHtml(gid, h, selected, optionStyle)
    {
        if( selected === undefined ) selected = 1;

        return `<select id='bd-${gid}' style="position:absolute;right:50px;width:80px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">
                    <option value="0" ${optionStyle} ${(selected == 0) ? 'selected' : ''}>${i18n('ui.interval._10m')}</option>
                    <option value="1" ${optionStyle} ${(selected == 1) ? 'selected' : ''}>${i18n('ui.interval.hourly')}</option>
                    <option value="2" ${optionStyle} ${(selected == 2) ? 'selected' : ''}>${i18n('ui.interval.daily')}</option>
                    <option value="3" ${optionStyle} ${(selected == 3) ? 'selected' : ''}>${i18n('ui.interval.monthly')}</option>
                </select>`;
    }

    parseIntervalConfig(s)
    {
        const options = { '10m' : 0, 'hourly' : 1, 'daily' : 2, 'monthly' : 3 };
        return options[s];
    }


    // --------------------------------------------------------------------------------------
    // Time ticks and step size
    // --------------------------------------------------------------------------------------

    computeTickDensity(width)
    {
        const densityLimit = ( this.pconfig.timeTickDensity == 'low' ) ? 2 : ( this.pconfig.timeTickDensity == 'medium' ) ? 1 : 0;
        return Math.max(( width < 650 ) ? 2 : ( width < 1100 ) ? 1 : 0, densityLimit);
    }

    setStepSize(update = false)
    {
        const width = this._this.querySelector('#maincard').clientWidth;

        const tdensity = this.computeTickDensity(width);

        if( this.activeRange.timeRangeHours ) {

            const range = this.activeRange.timeRangeHours;

            const stepSizes = [];
            stepSizes.push({ '1': '5m', '2': '10m', '3': '15m', '4': '30m', '5': '30m', '6': '30m', '7': '30m', '8': '30m', '9': '30m', '10': '1h', '11': '1h', '12': '1h', '24': '2h', '48': '4h', '72': '6h', '96': '6h', '120': '12h', '144': '12h', '168': '1d', '336': '1d', '504': '2d', '720': '2d', '2184': '1o', '4368': '1o' });
            stepSizes.push({ '1': '10m', '2': '20m', '3': '30m', '4': '1h', '5': '1h', '6': '1h', '7': '1h', '8': '1h', '9': '1h', '10': '2h', '11': '2h', '12': '2h', '24': '4h', '48': '8h', '72': '12h', '96': '1d', '120': '1d', '144': '1d', '168': '2d', '336': '3d', '504': '4d', '720': '7d', '2184': '1o', '4368': '1o' });
            stepSizes.push({ '1': '20m', '2': '30m', '3': '1h', '4': '2h', '5': '2h', '6': '2h', '7': '2h', '8': '2h', '9': '2h', '10': '4h', '11': '4h', '12': '4h', '24': '6h', '48': '12h', '72': '1d', '96': '2d', '120': '2d', '144': '2d', '168': '4d', '336': '7d', '504': '7d', '720': '14d', '2184': '1o', '4368': '1o' });

            this.activeRange.tickStepSize = stepSizes[tdensity][range].slice(0, -1);
            switch( stepSizes[tdensity][range].slice(-1)[0] ) {
                case 'm': this.activeRange.tickStepUnit = 'minute'; break;
                case 'h': this.activeRange.tickStepUnit = 'hour'; break;
                case 'd': this.activeRange.tickStepUnit = 'day';  break;
                case 'o': this.activeRange.tickStepUnit = 'month';  break;
            }

        } else if( this.activeRange.timeRangeMinutes ) {

            switch( tdensity ) {
                case 0: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 20 ) ? 1 : 5; break;
                case 1: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 10 ) ? 1 : ( this.activeRange.timeRangeMinutes < 30 ) ? 5 : 10; break;
                case 2: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 5 ) ? 1 : ( this.activeRange.timeRangeMinutes < 25 ) ? 5 : 10; break;
            }
            this.activeRange.tickStepUnit = 'minute';

        } else {

            this.activeRange.tickStepSize = 24;
            this.activeRange.tickStepUnit = 'hour';

        }

        if( update ) {
            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.update();
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Activate a given time range
    // --------------------------------------------------------------------------------------

    validateRange(range, hidden = false)
    {
        if( hidden && range < 12 && range > 0 ) return range;
        let i = ranges.findIndex(e => e >= range);
        if( i < ranges.length-1 && (i < 0 || ranges[i] != range) ) i++;
        return ranges[i];
    }

    setTimeRange(range, update, t_center = null, t_position = 0.5)
    {
        if( this.state.loading ) return;

        this.timeCache.clear();

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        const dataClusterSizes = { '48': 2, '72': 5, '96': 10, '120': 30, '144': 30, '168': 60, '336': 60, '504': 120, '720': 240, '2184': 240, '4368': 240 };
        const minute = 60000;

        this.activeRange.dataClusterSize = ( range >= 48 ) ? dataClusterSizes[range] * minute : 0;

        if( !this.pconfig.enableDataClustering ) this.activeRange.dataClusterSize = 0;

        this.activeRange.timeRangeHours = range;
        this.activeRange.timeRangeMinutes = 0;

        this.setStepSize(!update);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = range;

        if( update ) {

            if( t_center ) {

                let t1 = moment(t_center).add(this.activeRange.timeRangeHours * (1.0 - t_position), "hour");
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            } else if( this.activeRange.timeRangeHours > 24 ) {

                let t1 = moment(this.endTime);
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            } else {

                let tm = (moment(this.endTime) + moment(this.startTime)) / 2;
                let t1 = moment(tm).add(this.activeRange.timeRangeHours / 2, "hour");
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            }

            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

            this.updateHistory();

        }
    }

    setTimeRangeMinutes(range, update, t_center, t_position = 0.5)
    {
        if( this.state.loading ) return;

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        this.activeRange.dataClusterSize = 0;

        this.activeRange.timeRangeHours = 0;
        this.activeRange.timeRangeMinutes = range;

        this.setStepSize(!update);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = "0";

        if( update ) {

            if( !t_center ) 
                t_center = (moment(this.startTime) + moment(this.endTime)) / 2;

            let t1 = moment(t_center).add(this.activeRange.timeRangeMinutes * (1.0 - t_position), "minute");
            let t0 = moment(t1).subtract(this.activeRange.timeRangeMinutes, "minute");
            this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

            this.updateHistory();

        }
    }

    setTimeRangeFromString(range, update = false, t_center = null)
    {
        const s = range.slice(0, -1);

        let t = 0;
        switch( range.slice(-1)[0] ) {
            case 'm': t = s*1; break;
            case 'h': t = s*60; break;
            case 'd': t = s*24*60; break;
            case 'w': t = s*7*24*60; break;
            default: t = range*60; break;
        }

        const h = Math.floor(t / 60);

        if( h > 0 )
            this.setTimeRange(this.validateRange(h, true), update, t_center);
        else
            this.setTimeRangeMinutes(t, update, t_center);
    }


    // --------------------------------------------------------------------------------------
    // Helper functions
    // --------------------------------------------------------------------------------------

    findFirstIndex(array, range, predicate)
    {
        let l = range.start - 1;
        while( l++ < range.end ) {
            if( predicate(array[l]) ) return l;
        }
        return -1;
    }

    findLastIndex(array, range, predicate)
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

    initCache()
    {
        let d = moment().format("YYYY-MM-DD") + "T00:00:00";
        d = moment(d).subtract(cacheSize, "day").format("YYYY-MM-DD") + "T00:00:00";

        for( let i = 0; i < cacheSize+1; i++ ) {
            let e = moment(d).add(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.push({ "start" : d, "end" : e, "start_m" : moment(d), "end_m": moment(e), "data" : [], "valid": false });
            d = e;
        }
    }

    mapStartTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < cacheSize+1; i++ ) {
            if( mt >= this.cache[i].start_m && mt < this.cache[i].end_m ) return i;
        }

        if( mt < this.cache[0].start_m ) return 0;

        return -1;
    }

    mapEndTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < cacheSize+1; i++ ) {
            if( mt > this.cache[i].start_m && mt <= this.cache[i].end_m ) return i;
        }

        if( mt > this.cache[cacheSize].end_m ) return cacheSize;

        return -1;
    }

    findCacheEntityIndex(c_id, entity)
    {
        if( !this.cache[c_id].valid ) return -1;

        for( let i = 0; i < this.cache[c_id].entities.length; i++ ) {
            if( this.cache[c_id].entities[i] == entity ) return i;
        }

        return -1;
    }

    generateGraphDataFromCache()
    {
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        if( c0 >= 0 && c1 >= 0 ) {

            //console.log(`merge from ${c0} to ${c1}`);

            // Build partial data
            // The result data for the charts is expected in order of the charts entities, but the cache might not hold data 
            // for all the entities or it might be in a different order. So for every chart entity, search the cache for a match.
            // If no match found, then add en empty record into the result, so to keep the indices in sync for buildChartData().
            let result = [];
            for( let i = c0; i <= c1; i++ ) {
                let j = 0;
                for( let g of this.graphs ) {
                    for( let e of g.entities ) {
                    if( result[j] == undefined ) result[j] = [];
                        const k = this.findCacheEntityIndex(i, e.entity);
                        if( k >= 0 ) 
                            result[j] = result[j].concat(this.cache[i].data[k]);
                        j++;
                    }
                }
            }

            // Add the very last state from the cache slot just before the requested one, if possible.
            // This is to ensure that the charts have one data point just before the start of their own data
            // This avoids interpolation issues at the chart start and disappearing states at the beginning of timelines.
            if( c0 > 0 && this.cache[c0-1].valid ) {
                let j = 0;
                for( let g of this.graphs ) {
                    for( let e of g.entities ) {
                        for( let i = c0-1; i >= 0 && this.cache[i].valid; i-- ) {
                            const k = this.findCacheEntityIndex(i, e.entity);
                            if( k >= 0 ) {
                                let n = this.cache[i].data[k].length;
                                if( n > 0 ) {
                                    result[j].unshift({ "last_changed": this.cache[c0].start, "state": this.cache[i].data[k][n-1].state });
                                    break;
                                }
                            }
                        }
                        j++;
                    }
                }

            }

            this.buildChartData(result);

        } else

            this.buildChartData(null);
    }


    // --------------------------------------------------------------------------------------
    // Search the first cache slot that contains data for the required timecode (full or partial)
    // --------------------------------------------------------------------------------------

    searchFirstAffectedSlot(a, b, t)
    {
        for( let i = a; i <= b; i++ ) {
            if( this.cache[i].end_m >= t ) return i;
        }
        return undefined;
    }


    // --------------------------------------------------------------------------------------
    // On demand history retrieval
    // --------------------------------------------------------------------------------------

    loaderCallback(result)
    {
        //console.log("database retrieval OK");
        //console.log(result);

        if( this.databaseCallback ) 
            this.databaseCallback(result.length > 0);

        let reload = false;
        let m = 0;

        // Dynamically check if the data pulled from the history DB is still available, if not switch to statistics and reschedule a retrieval
        if( this.statistics.enabled && !this.loader.loadingStats ) {

            // Get the first slot affected by the returned result
            m = cacheSize;
            for( let j of result ) {
                let v = this.searchFirstAffectedSlot(this.loader.startIndex, this.loader.endIndex, moment(j[0].last_changed));
                //console.log(`${j[0].entity_id} -> ${j[0].last_changed} -> slot ${v}`);
                if( v && v < m ) m = v;
            }

            // 
            if( m > this.loader.startIndex && this.statistics.retention ) {
                const limit = cacheSize - this.statistics.retention;
                if( m > limit ) {
                    console.warn(`first partial slot ${m}, first history slot is ${limit}`);
                    m = limit;
                }
            }

            // If the first slot with data doesn't cover the full requested time period, then switch to statistics from the that slot and earlier ones
            if( m > this.loader.startIndex ) {
                m++;        // Replace partially filled slot with statistics data
                this.limitSlot = m-1;
                reload = true;
                //console.log(`Loader switched to statistics (slot ${this.loader.startIndex} to ${this.loader.endIndex}, first full at ${m})`);
            }

        }

        this.loader.loadingStats = false;

        if( this.loader.startIndex == this.loader.endIndex ) {

            // Retrieved data maps to a single slot directly

            if( this.loader.startIndex >= m ) {
                this.cache[this.loader.startIndex].data = result;
                this.cache[this.loader.startIndex].valid = true;
            }

        } else {

            // Retrieved multiple slots, needs to be split accordingly

            for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
                this.cache[i].data = [];
                this.cache[i].valid = i >= m;
            }

            for( let j of result ) {

                let p0 = 0;

                for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {

                    // Find first index that doesn't fit into cache slot [i] anymore (one after the end of the slot data)
                    let t = moment(this.cache[i].end);
                    let p1 = this.findFirstIndex(j, { start: p0, end: j.length-1 }, function(e) { return moment(e.last_changed) >= t });

                    // If none found, this means that everything up to the end goes into the current slot
                    if( p1 < 0 ) p1 = j.length;

                    // Copy the valid part into the current cache slot
                    let r = j.slice(p0, p1);
                    this.cache[i].data.push(r);

                    // Next slot range
                    p0 = p1;

                }

            }

        }

        // Update the list of entities present in the cache slots (the data is in that order)
        for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
            this.cache[i].entities = [];
            for( let j of result ) {
                this.cache[i].entities.push(j[0].entity_id);
            }
        }

        this.generateGraphDataFromCache();

        this.state.loading = false;

        if( reload ) this.updateHistory();
    }

    loaderFailed(error) 
    {
        console.log("Database request failure");
        console.log(error);

        if( this.databaseCallback ) 
            this.databaseCallback(false);

        this.buildChartData(null);

        this.state.loading = false;
    }

    loaderCallbackStats(result)
    {
        const m = this.statistics.mode;

        let r = [];

        for( let entity in result ) {
            const a = result[entity];
            let j = [];
            j.push({'last_changed' : a[0].start, 'state' : a[0][m] ?? a[0].state, 'entity_id' : a[0].statistic_id});
            for( let i = 1; i < a.length; i++ ) {
                j.push({'last_changed' : a[i].start, 'state' : a[i][m] ?? a[i].state});
            }
            r.push(j);
        }

        this.loader.loadingStats = true;

        this.loaderCallback(r);
    }


    // --------------------------------------------------------------------------------------
    // Graph data generation
    // --------------------------------------------------------------------------------------

    momentCache(tc)
    {
        let r;
        if( tc !== undefined ) {
            if( !this.timeCache.has(tc) ) {
                r = moment(tc);
                this.timeCache.set(tc, r);
            } else 
                r = this.timeCache.get(tc);
        }
        return r;
    }

    buildChartData(result)
    {
        let m_now = moment();
        let m_start = moment(this.startTime);
        let m_end = moment(this.endTime);

        const isDataValid = state => this.pconfig.showUnavailable || !['unavailable', 'unknown'].includes(state);

        let id = 0;

        for( let g of this.graphs ) {

            let updated = false;

            for( let j = 0; j < g.entities.length; j++, id++ ) {

                if( this.state.updateCanvas && this.state.updateCanvas !== g.canvas ) continue;

                var s = [];
                var bcol = [];

                if( result && result.length > id ) {

                    var n = result[id].length;

                    if( g.type == 'line' ) {

                        // Fill line chart buffer

                        const scale = g.entities[j].scale ?? 1.0;

                        const enableClustering = g.entities[j].decimation == undefined || g.entities[j].decimation;

                        if( n > 2 && enableClustering && this.activeRange.dataClusterSize > 0 ) {

                            let last_time = this.momentCache(result[id][0].last_changed);

                            for( let i = 0; i < n; i++ ) {
                                if( isDataValid(result[id][i].state) ) {
                                    let this_time = this.momentCache(result[id][i].last_changed);
                                    if( !i || this_time.diff(last_time) >= this.activeRange.dataClusterSize ) {
                                        s.push({ x: this_time, y: result[id][i].state * scale});
                                        last_time = this_time;
                                    }
                                }
                            }

                        } else {

                            for( let i = 0; i < n; i++ ) {
                                if( isDataValid(result[id][i].state) ) {
                                    s.push({ x: result[id][i].last_changed, y: result[id][i].state * scale});
                                }
                            }
                        }

                        if( m_now > m_end && s.length > 0 && moment(s[s.length-1].x) < m_end ) {
                            s.push({ x: m_end, y: result[id][n-1].state * scale});
                        } else if( m_now <= m_end && s.length > 0 && moment(s[s.length-1].x) < m_now ) {
                            s.push({ x: m_now, y: result[id][n-1].state * scale});
                        }

                    } else if( g.type == 'bar' && n > 0 ) {

                        const scale = g.entities[j].scale ?? 1.0;

                        const colorRange = ( g.entities[j].color && g.entities[j].color.constructor == Object ) ? g.entities[j].color : null;

                        let td;
                        if( g.interval == 0 ) td = moment.duration(10, "minute"); else
                        if( g.interval == 1 ) td = moment.duration(1, "hour"); else
                        if( g.interval == 2 ) td = moment.duration(1, "day"); else
                        if( g.interval == 3 ) td = moment.duration(1, "month");

                        let i = 0;
                        let y0 = result[id][0].state * 1.0;
                        let y1 = y0;

                        // Start time of the range, snapped to interval boundary
                        const f = ( g.interval <= 1 ) ? 'YYYY-MM-DDTHH[:00:00]' : ( g.interval <= 2 ) ? 'YYYY-MM-DDT[00:00:00]' : 'YYYY-MM-[01]T[00:00:00]';
                        let t = moment(moment(m_start).format(f));

                        // Search for the first state in the time range
                        while( i < n-1 && moment(result[id][i].last_changed) <= t ) y0 = result[id][i++].state * 1.0;

                        // Calculate differentials over the time range in interval sized stacks, add a half interval at the end so that the last bar doesn't jump
                        // Add them to the graph with a half interval time offset, so that the stacks align at the center of their respective intervals
                        for( ; t <= m_end + td; ) {
                            let te = moment(t).add(td);
                            y1 = y0;
                            let d = 0;
                            while( i < n && moment(result[id][i].last_changed) < te ) {
                                const rawstate = result[id][i].state;
                                if( !['unavailable', 'unknown'].includes(rawstate) ) {
                                    const state = rawstate * 1.0;
                                    if( state < y1 ) {
                                        d += y1 - y0;
                                        y0 = state;
                                    }
                                    y1 = state;
                                }
                                i++;
                            }
                            d += y1 - y0;
                            s.push({ x: t + td / 2.0, y: d * scale});
                            if( colorRange ) 
                                bcol.push(parseColorRange(colorRange, d));
                            t = te;
                            y0 = y1;
                        }

                    } else if( g.type == 'timeline' || g.type == 'arrowline' ) {

                        // Fill timeline chart buffer

                        let enableClustering = g.entities[j].decimation == undefined || g.entities[j].decimation;

                        if( g.type == 'arrowline' ) enableClustering = false;

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

                            let moment_t0 = this.momentCache(t0);
                            let moment_t1 = ( t1 === m_max ) ? moment(t1) : this.momentCache(t1);

                            if( !enableClustering || moment_t1.diff(moment_t0) >= this.activeRange.dataClusterSize || i == n-1 ) {
                                // Larger than merge limit, finish a potential current merge before proceeding with new block
                                // Also stop merging when hitting the last state block regardless of size, otherwise it wont be committed
                                if( merged > 0 ) {
                                    t0 = mt0;
                                    t1 = mt1;
                                    moment_t0 = moment(t0);
                                    moment_t1 = moment(t1);
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
                            if( moment_t1 >= m_start ) {
                                if( moment_t1 > m_end ) t1 = this.endTime;
                                if( moment_t0 > m_end ) break;
                                if( moment_t0 < m_start ) t0 = this.startTime;
                                let e = [];
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

                if( bcol.length > 0 ) {
                    g.chart.data.datasets[j].backgroundColor = bcol;
                    g.chart.data.datasets[j].borderColor = bcol;
                }

                updated = true;

            }

            if( updated ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

        }
    }


    // --------------------------------------------------------------------------------------
    // New graph creation
    // --------------------------------------------------------------------------------------

    generateTooltipContents(label, d, mode, n = 1)
    {
        if( this.pconfig.tooltipShowDuration ) {
            const duration = moment(d[1]).diff(moment(d[0]));
            const s = moment.utc(duration).format('HH:mm:ss');
            label = `${label}  (for ${s})`;
        }

        if( mode == 'compact' || mode == 'slim' || ( mode == 'auto' && n < 2 ) )
            return [label, moment(d[0]).format(this.i18n.styleDateTimeTooltip) + " -- " + moment(d[1]).format(this.i18n.styleDateTimeTooltip)];
        else
            return [label, moment(d[0]).format(this.i18n.styleDateTimeTooltip), moment(d[1]).format(this.i18n.styleDateTimeTooltip)];
    }

    newGraph(canvas, graphtype, datasets, config)
    {
        const ctx = canvas.getContext('2d');

        var datastructure;

        let scaleUnit;

        if( graphtype == 'line' || graphtype == 'bar' ) {

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
                    steppedLine: d.mode === 'stepped',
                    cubicInterpolationMode: ( d.mode !== 'stepped' && d.mode !== 'lines' ) ? 'monotone' : 'default',
                    lineTension: ( d.mode === 'lines' ) ? 0 : undefined,
                    domain: d.domain,
                    entity_id: d.entity_id,
                    unit: d.unit,
                    data: { }
                });
                scaleUnit = scaleUnit ?? d.unit;
            }

        } else if( graphtype == 'timeline' || graphtype == 'arrowline' ) {

            datastructure = {
                labels: [ ],
                datasets: [ ]
            };

            for( let d of datasets ) {
                datastructure.labels.push(this.pconfig.labelsVisible ? d.name : '');
                datastructure.datasets.push({ 
                    domain: d.domain,
                    device_class: d.device_class,
                    entity_id: d.entity_id,
                    unit: d.unit,
                    arrowColor: d.bColor,
                    arrowBackground: d.fillColor,
                    data: [ ] 
                });
            }

        }

        const tooltipSize = this.pconfig.tooltipSize;

        var chart = new Chart(ctx, { 

            type: graphtype, 

            data: datastructure,

            options: {
                scales: {
                    xAxes: [{ 
                        type: ( graphtype == 'line' || graphtype == 'bar' ) ? 'time' : ( graphtype == 'arrowline' ) ? 'arrowline' : 'timeline',
                        time: {
                            unit: this.activeRange.tickStepUnit,
                            stepSize: this.activeRange.tickStepSize,
                            displayFormats: { 'minute': this.i18n.styleTimeTicks, 'hour': this.i18n.styleTimeTicks, 'day': this.i18n.styleDateTicks },
                            tooltipFormat: this.i18n.styleDateTimeTooltip,
                        },
                        ticks: {
                            fontColor: ( config?.showTimeLabels === false ) ? 'rgba(0,0,0,0)' : this.pconfig.graphLabelColor,
                            major: {
                                enabled: true,
                                unit: 'day',
                                fontStyle: 'bold',
                                unitStepSize: 1,
                                displayFormats: { 'day': this.i18n.styleDateTicks },
                            },
                            maxRotation: 0
                        },
                        gridLines: {
                            color: this.pconfig.graphGridColor
                        }
                    }],
                    yAxes: [{
                        afterFit: (scaleInstance) => {
                            scaleInstance.width = this.pconfig.labelAreaWidth;
                        },
                        afterDataLimits: (me) => {
                            const epsilon = 0.0001;
                            if( config?.ymin == null && this.pconfig.axisAddMarginMin && graphtype == 'line' ) me.min -= epsilon;
                            if( config?.ymax == null && this.pconfig.axisAddMarginMax && graphtype == 'line' ) me.max += epsilon;
                        },
                        ticks: {
                            fontColor: this.pconfig.graphLabelColor,
                            min: config?.ymin ?? undefined,
                            max: config?.ymax ?? undefined,
                            forceMin: config?.ymin ?? undefined,
                            forceMax: config?.ymax ?? undefined,
                        },
                        gridLines: {
                            color: ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)'
                        },
                        scaleLabel: {
                            display: scaleUnit !== undefined && scaleUnit !== '' && this.pconfig.labelsVisible,
                            labelString: scaleUnit,
                            fontColor: this.pconfig.graphLabelColor
                        }
                    }],
                },
                topClipMargin : ( config?.ymax == null ) ? 4 : 1,
                bottomClipMargin: ( config?.ymin == null ) ? 4 : 1,
                animation: {
                    duration: 0
                },
                tooltips: {
                    callbacks: {
                        label: (item, data) => {
                            if( graphtype == 'line' || graphtype == 'bar' ) {
                                let label = data.datasets[item.datasetIndex].label || '';
                                if( label ) label += ': ';
                                const p = 10 ** this.pconfig.roundingPrecision;
                                label += Math.round(item.yLabel * p) / p;
                                label += ' ' + (data.datasets[item.datasetIndex].unit || '');
                                return label;
                            } else if( graphtype == 'timeline' ) {
                                const d = data.datasets[item.datasetIndex].data[item.index];
                                return this.generateTooltipContents(d[2], d, tooltipSize, datasets.length);
                            } else if( graphtype == 'arrowline' ) {
                                const d = data.datasets[item.datasetIndex].data[item.index];
                                const p = 10 ** this.pconfig.roundingPrecision;
                                let label = Math.round(d[2] * p) / p;
                                label += ' ' + (data.datasets[item.datasetIndex].unit || '');
                                return this.generateTooltipContents(label, d, 'slim');
                            }
                        },
                        title: function(tooltipItems, data) {
                            let title = '';
                            if( tooltipItems.length > 0 ) {
                                if( graphtype == 'line' || graphtype == 'bar' ) {
                                    title = tooltipItems[0].xLabel;
                                } else {
                                    let d = data.labels[tooltipItems[0].datasetIndex];
                                    title = ( tooltipSize !== 'slim' ) ? d : '';
                                }
                            }
                            return title;
                        }
                    },
                    yAlign: ( graphtype == 'line' || graphtype == 'bar' ) ? undefined : 'nocenter',
                    caretPadding: 8,
                    displayColors: ( graphtype == 'line' ) ? this.pconfig.showTooltipColors[0] : ( graphtype == 'timeline' ) ? this.pconfig.showTooltipColors[1] : false
                },
                hover: {
                    mode: 'nearest'
                },
                legend: {
                    display: ( graphtype == 'line' || graphtype == 'bar' ) && this.pconfig.hideLegend != true,
                    labels: {
                        fontColor: this.pconfig.graphLabelColor,
                        usePointStyle: ( graphtype == 'line' || (graphtype == 'bar' && datasets.length > 1) ),
                        boxWidth: 0
                    }
                },
                elements: {
                    textFunction: (text, datasets, index) => {
                        switch( this.pconfig.stateTextMode ) {
                          case 'auto' : return this.getLocalizedState(text, datasets[index].domain, datasets[index].device_class, datasets[index].entity_id);
                          case 'hide' : return '';
                          default: return text;
                        }
                    },
                    colorFunction: (text, data, datasets, index) => {
                        // * check device_class.state first (if it exists)
                        // * if not found, then check domain.state
                        // * if not found, check global state
                        return this.getStateColor(datasets[index].domain, datasets[index].device_class, datasets[index].entity_id, data[2]);
                    },
                    showText: true,
                    font: 'normal 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
                    textPadding: 4,
                    arrowColor: getComputedStyle(document.body).getPropertyValue('--primary-text-color')
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

    updateHistory()
    {
        for( let i of this.ui.dateSelector )
            if( i ) i.innerHTML = moment(this.startTime).format(this.i18n.styleDateSelector);

        // Prime the cache on first call
        if( !this.cache.length ) this.initCache();

        // Get cache slot indices for beginning and end of requested time range
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        //console.log(`Slots ${c0} to ${c1}`);

        // Get the cache slot (sub)range that needs to be retrieved from the db
        let l0 = ( c0 >= 0 ) ? this.findFirstIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;
        let l1 = ( c1 >= 0 ) ? this.findLastIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;

        if( l0 >= 0 ) {

            // Requested data range is not yet loaded. Get it from database first and update the chart data aysnc when fetched.

            // TODO: handle this with a scheduled reload
            if( this.state.loading ) {
                if( l0 >= this.loader.startIndex && l1 <= this.loader.endIndex ) return;
                console.log(`Slots ${l0} to ${l1} need loading`);
                console.log(`Double loading blocked, slots ${this.loader.startIndex} to ${this.loader.endIndex} are currently loading`);
                return;
            }

            //console.log(`Slots ${l0} to ${l1} need loading`);

            this.loader.startTime = this.cache[l0].start;
            this.loader.endTime = this.cache[l1].end;
            this.loader.startIndex = l0;
            this.loader.endIndex = l1;

            // Prepare db retrieval request for all visible entities
            let n = 0;
            let t0 = this.loader.startTime.replace('+', '%2b');
            let t1 = this.loader.endTime.replace('+', '%2b');
            let l = [];
            let url = `history/period/${t0}?end_time=${t1}&minimal_response&no_attributes&filter_entity_id`;
            let separator = '=';
            for( let g of this.graphs ) {
                for( let e of g.entities ) {
                    l.push(e.entity);
                    url += separator;
                    url += e.entity;
                    separator = ',';
                    n++;
                }
            }

            if( n > 0 ) {

                this.state.loading = true;

                if( !this.statistics.enabled || l0 > this.limitSlot ) {

                    // Issue retrieval call, initiate async cache loading
                    const p = this.callHassAPIGet(url);
                    p.then(this.loaderCallback.bind(this), this.loaderFailed.bind(this));

                } else {

                    // Issue statistics retrieval call
                    let d = { 
                        type: "history/statistics_during_period",
                        start_time: t0,
                        end_time: t1,
                        period: "hour",
                        statistic_ids: l
                    };
                    this._hass.callWS(d).then(this.loaderCallbackStats.bind(this), this.loaderFailed.bind(this));

                }

            }

        } else

            // All needed slots already in the cache, generate the chart data
            this.generateGraphDataFromCache();
    }

    updateHistoryWithClearCache()
    {
        if( !this.state.loading ) {
            this.cache.length = 0;
            this.updateHistory();
        }
    }

    updateAxes()
    {
        for( let g of this.graphs ) {
            if( !this.state.updateCanvas || this.state.updateCanvas === g.canvas ) {
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Panning
    // --------------------------------------------------------------------------------------


    pixelPositionToTimecode(x)
    {
        const f = (x - panstate.g.chart.chartArea.left) / (panstate.g.chart.chartArea.right - panstate.g.chart.chartArea.left);

        return this.factorToTimecode(f);
    }

    factorToTimecode(f)
    {
        return moment(this.startTime) + moment(this.endTime).diff(this.startTime) * f;
    }

    pointerDown(event)
    {
        panstate.g = null;

        for( let g of this.graphs ) {
            if( g.canvas === event.target ) {
                panstate.g = g;
                g.chart.options.tooltips.enabled = false;
                g.chart.options.scales.yAxes[0].ticks.min = g.chart.scales["y-axis-0"].min;
                g.chart.options.scales.yAxes[0].ticks.max = g.chart.scales["y-axis-0"].max;
                g.chart.options.topClipMargin = 0;
                g.chart.options.bottomClipMargin = 0;
                break;
            }
        }

        if( panstate.g ) {

            panstate.mx = event.clientX;
            panstate.lx = event.clientX;

            event.target?.setPointerCapture(event.pointerId);

            if( !this.state.zoomMode ) {            

                this.state.drag = true;

                panstate.tc = this.startTime;

                this.state.updateCanvas = this.pconfig.lockAllGraphs ? null : event.target;

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

                    panstate.st0 = this.pixelPositionToTimecode(x0);

                    this.state.selecting = true;

                }

            }

        }
    }

    pointerMove(event)
    {
        if( this.state.drag ) {

            if( Math.abs(event.clientX - panstate.lx) > 0 ) {

                panstate.lx = event.clientX;

                const w = panstate.g.chart.chartArea.right - panstate.g.chart.chartArea.left;

                const x = Math.floor((event.clientX - panstate.mx) * ((3600.0 * this.activeRange.timeRangeHours + 60.0 * this.activeRange.timeRangeMinutes) / w));

                if( x < 0 ) {
                    let t0 = moment(panstate.tc).add(-x, "second");
                    let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");
                    this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                    this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");			
                } else if( x > 0 ) {
                    let t0 = moment(panstate.tc).subtract(x, "second");
                    let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");;
                    this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                    this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
                }

                if( !this.state.loading )
                    this.updateHistory();
                else
                    this.updateAxes();

            }

        } else if( this.state.selecting && panstate.overlay ) {

            let ctx = panstate.overlay.getContext('2d');
            ctx.clearRect(0, 0, panstate.overlay.width, panstate.overlay.height);

            const rect = panstate.overlay.getBoundingClientRect();
            const x0 = panstate.mx - rect.left;
            const x1 = Math.max(Math.min(event.clientX - rect.left, panstate.g.chart.chartArea.right), panstate.g.chart.chartArea.left);        

            ctx.fillStyle = this.ui.darkMode ? '#ffffff20' : '#00000020';
            ctx.fillRect(x0, panstate.g.chart.chartArea.top, x1-x0, panstate.g.chart.chartArea.bottom - panstate.g.chart.chartArea.top);

            panstate.st1 = this.pixelPositionToTimecode(x1);

        }
    }

    pointerUp(event)
    {
        if( this.state.drag ) {

            this.state.drag = false;
            this.state.updateCanvas = null;

            panstate.g.chart.options.tooltips.enabled = true;

            if( panstate.g.chart.options.scales.yAxes[0].ticks.forceMin === undefined ) {
                panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
                panstate.g.chart.options.bottomClipMargin = 4;
            } else
                panstate.g.chart.options.bottomClipMargin = 1;

            if( panstate.g.chart.options.scales.yAxes[0].ticks.forceMax === undefined ) {
                panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;
                panstate.g.chart.options.topClipMargin = 4;
            } else 
                panstate.g.chart.options.topClipMargin = 1;

            this.updateHistory();

        }

        if( this.state.selecting ) {

            this.state.selecting = false;

            panstate.g.chart.options.tooltips.enabled = true;

            panstate.overlay.remove();
            panstate.overlay = null;

            if( panstate.st1 < panstate.st0 ) [panstate.st1, panstate.st0] = [panstate.st0, panstate.st1];

            const tm = (moment(panstate.st1) + moment(panstate.st0)) / 2;

            // Time delta in minutes
            const dt = moment.duration(panstate.st1 - panstate.st0).asMinutes();

            // Time delta in hours, ceiled
            let d = ( dt >= 60.0 ) ? Math.ceil(dt / 60.0) : 0;
            
            if( d < 12 ) {

                if( d < 1 )
                    this.setTimeRangeMinutes(Math.ceil(dt), true, tm);
                else
                    this.setTimeRange(d, true, tm);

            } else {

                d = Math.ceil(d / 24.0);

                if( d < 1 ) this.setTimeRange(12, true, tm); else       // 12 hours
                if( d < 2 ) this.setTimeRange(24, true, tm); else       // 1 day
                if( d < 3 ) this.setTimeRange(48, true, tm); else       // 2 days
                if( d < 4 ) this.setTimeRange(72, true, tm); else       // 3 days
                if( d < 5 ) this.setTimeRange(96, true, tm); else       // 4 days
                if( d < 6 ) this.setTimeRange(120, true, tm); else      // 5 days
                if( d < 7 ) this.setTimeRange(144, true, tm); else      // 6 days
                if( d < 13 ) this.setTimeRange(168, true, tm); else     // 1 week
                if( d < 20 ) this.setTimeRange(336, true, tm); else     // 2 weeks
                if( d < 28 ) this.setTimeRange(504, true, tm); else     // 3 weeks
                             this.setTimeRange(720, true, tm);          // 1 month

            }

            this.toggleZoom();

        }

        panstate.g = null;
    }

    pointerCancel(event)
    {
        if( this.state.drag ) {

            this.state.drag = false;
            this.state.updateCanvas = null;

            panstate.g.chart.options.tooltips.enabled = true;
            panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
            panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;
            panstate.g.chart.options.topClipMargin = 4;
            panstate.g.chart.options.bottomClipMargin = 4;

        }

        if( this.state.selecting ) {

            this.state.selecting = false;

            panstate.g.chart.options.tooltips.enabled = true;

            panstate.overlay.remove();
            panstate.overlay = null;

        }

        panstate.g = null;
    }

    wheelScrolled(event)
    {
        if( event.ctrlKey ) {
            event.preventDefault();
            if( !this.graphs.length || this.state.loading ) return;
            const rect = this.graphs[0].canvas.getBoundingClientRect();
            const chartArea = this.graphs[0].chart.chartArea;
            const x0 = event.clientX - rect.left - chartArea.left;
            const f = x0 / (chartArea.right - chartArea.left);
            const tc = this.factorToTimecode(f);
            if( event.deltaY < 0 ) this.incZoomStep(tc, f); else
            if( event.deltaY > 0 ) this.decZoomStep(tc, f);
        }
    }


    // --------------------------------------------------------------------------------------
    // Dynamic entity adding
    // --------------------------------------------------------------------------------------

    matchWildcardPattern(s)
    {
        s = s.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&');
        s = s.replace(/\\\*/g, '.*')
        return new RegExp('^'+s+'$', 'i');
    }

    addEntitySelected(event)
    {
        if( this.state.loading ) return;

        let ii = event.target ? ( event.target.id == 'b8_0' ) ? 0 : 1 : -1;
        if( ii < 0 ) return;

        const entity_id = this.ui.inputField[ii]?.value;

        for( let i of this.ui.inputField ) if( i ) i.value = "";

        // Single entity or wildcard ?
        if( entity_id.indexOf('*') >= 0 ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${ii}` : `#b6_${this.cid}`);
            if( !datalist ) return;

            // Convert wildcard to regex
            const regex = this.matchWildcardPattern(entity_id);

            for( let e of Array.from(datalist.children) ) {
                const entity_id = e.innerText;
                if( regex.test(entity_id) ) {
                    if( this._hass.states[entity_id] == undefined ) continue;
                    this.addDynamicGraph(entity_id);
                    this.pconfig.entities.push(entity_id);
                }
            }

        } else {

            if( this._hass.states[entity_id] == undefined ) return;

            this.addDynamicGraph(entity_id);

            this.pconfig.entities.push(entity_id);

        }

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    removeAllEntities()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        if( !confirm(i18n('ui.popup.remove_all')) ) return;

        let a = 0;
        for( a = 0; a < this.graphs.length; a++ ) 
            if( this.graphs[a].id >= this.firstDynamicId ) break;

        for( let i = a; i < this.graphs.length; i++ )
            this.graphs[i].canvas.parentNode.remove();

        this.graphs.splice(a);
        this.pconfig.entities = [];

        this.writeLocalState();
    }


    // --------------------------------------------------------------------------------------
    // Adding and removing graphs from the view
    // --------------------------------------------------------------------------------------

    getDomainForEntity(entity)
    {
        return entity.substr(0, entity.indexOf("."));
    }

    getDeviceClass(entity)
    {
        return this._hass.states[entity]?.attributes?.device_class;
    }

    getUnitOfMeasure(entity, manualUnit)
    {
        return ( manualUnit === undefined ) ? this._hass.states[entity]?.attributes?.unit_of_measurement : manualUnit;
    }

    getStateClass(entity)
    {
        return this._hass.states[entity]?.attributes?.state_class;
    }

    getEntityOptions(entity)
    {
        const dc = this.getDeviceClass(entity);
        let c = dc ? this.pconfig.entityOptions?.[dc] : undefined;
        c = c ?? this.pconfig.entityOptions?.[entity];
        return c ?? undefined;
    }

    calcGraphHeight(type, n)
    {
        const m = ( n >= 2 || this.pconfig.tooltipSize == 'full' ) ? 130 : ( this.pconfig.tooltipSize == 'slim' ) ? 90 : 115;
        return ( type == 'line' ) ? this.pconfig.lineGraphHeight : ( type == 'bar' ) ? this.pconfig.barGraphHeight + 24 : Math.max(n * 45, m);
    }

    removeGraph(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {
                this.graphs[i].canvas.parentNode.remove();
                for( let e of this.graphs[i].entities ) {
                    const j = this.pconfig.entities.indexOf(e.entity);
                    if( j >= 0 ) this.pconfig.entities.splice(j, 1);
                }
                this.graphs.splice(i, 1);
                break;
            }
        }

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    addFixedGraph(g)
    {
        // Add fixed graphs from YAML
        if( g.graph.type == 'line' || g.graph.type == 'bar' ) {

            let entities = [];
            for( let d of g.graph.entities ) {
                const dc = this.getNextDefaultColor();
                const color = d.color ?? dc.color;
                let fill = d.fill ?? (d.color ? 'rgba(0,0,0,0)' : dc.fill);
                if( g.graph.type == 'bar' ) fill = color;
                entities.push({ ...d, 'color' : color, 'fill' : fill }); 
            }

            this.addGraphToCanvas(g.id, g.graph.type, entities, g.graph.options);

        } else

            this.addGraphToCanvas(g.id, g.graph.type, g.graph.entities, g.graph.options);

        // For bar graphs, connect the interval selector dropdown listener
        if( g.graph.type == 'bar' )
            this._this.querySelector(`#bd-${g.id}`)?.addEventListener('change', this.selectBarInterval.bind(this));
    }

    addDynamicGraph(entity_id)
    {
        // Add dynamic entity

        if( this._hass.states[entity_id] == undefined ) return;

        var entityOptions = this.getEntityOptions(entity_id);

        const type = entityOptions?.type ? entityOptions.type : ( this.getUnitOfMeasure(entity_id) == undefined ) ? 'timeline' : ( this.getStateClass(entity_id) === 'total_increasing' ) ? 'bar' : 'line';

        let entities = [{ "entity": entity_id, "color": "#000000", "fill": "#00000000" }];

        // Get the options for line and arrow graphs (use per device_class options if available, otherwise use defaults)
        if( type == 'line' || type == 'arrowline' || type == 'bar' ) {

            if( entityOptions?.color ) {
                entities[0].color = entityOptions?.color;
                entities[0].fill = entityOptions?.fill ?? 'rgba(0,0,0,0)';
            } else {
                const c = this.getNextDefaultColor();
                entities[0].color = c.color;
                entities[0].fill = entityOptions?.fill ?? c.fill;
            }

            entities[0].width = entityOptions?.width;
            entities[0].lineMode = entityOptions?.lineMode;
            entities[0].scale = entityOptions?.scale;

            if( type == 'bar' )
                entities[0].fill = entities[0].color;

        }

        const last = this.graphs.length - 1;

        // Add to an existing timeline graph and compatible line graph if possible
        let combine = last >= 0 && 
                      type != 'bar' &&
                      this.graphs[last].type === type &&
                      ( type == 'timeline' || this.pconfig.combineSameUnits && this.getUnitOfMeasure(entity_id) == this.getUnitOfMeasure(this.graphs[last].entities[0].entity) );

        if( combine ) {

            // Add the new entity to the previous ones
            entities = this.graphs[this.graphs.length-1].entities.concat(entities);

            // Delete the old graph, will be regenerated below including the new entity
            this.graphs[this.graphs.length-1].canvas.parentNode.remove();
            this.graphs.length--;

        }

        const h = this.calcGraphHeight(type, entities.length);

        let html = '';
        html += `<div sytle='height:${h}px'>`;
        html += `<canvas id="graph${this.g_id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
        html += `<button id='bc-${this.g_id}' style="position:absolute;right:20px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">×</button>`;
        if( type == 'bar' ) 
            html += this.createIntervalSelectorHtml(this.g_id, h, this.parseIntervalConfig(entityOptions?.interval), this.ui.optionStyle);
        html += `</div>`;

        let e = document.createElement('div');
        e.innerHTML = html;

        let gl = this._this.querySelector('#graphlist');
        gl.appendChild(e);

        if( type == 'bar' )
            this._this.querySelector(`#bd-${this.g_id}`).addEventListener('change', this.selectBarInterval.bind(this));

        this._this.querySelector(`#bc-${this.g_id}`).addEventListener('click', this.removeGraph.bind(this));

        this.addGraphToCanvas(this.g_id++, type, entities, entityOptions);
    }

    addGraphToCanvas(gid, type, entities, config)
    {
        const canvas = this._this.querySelector(`#graph${gid}`);

        let datasets = [];
        for( let d of entities ) {
            datasets.push({
                "name": ( d.name === undefined ) ? this._hass.states[d.entity]?.attributes?.friendly_name : d.name,
                "bColor": parseColor(d.color),
                "fillColor": parseColor(d.fill), 
                "mode": d.lineMode || this.pconfig.defaultLineMode, 
                "width": d.width || 2.0,
                "unit": this.getUnitOfMeasure(d.entity, d.unit),
                "domain": this.getDomainForEntity(d.entity),
                "device_class": this.getDeviceClass(d.entity),
                "entity_id" : d.entity
            });
        }

        const chart = this.newGraph(canvas, type, datasets, config);

        const h = this.calcGraphHeight(type, entities.length);

        const interval = this.parseIntervalConfig(config?.interval) ?? 1;

        const g = { "id": gid, "type": type, "canvas": canvas, "graphHeight": h, "chart": chart , "entities": entities, "interval": interval };

        this.graphs.push(g);

        canvas.addEventListener('pointerdown', this.pointerDown.bind(this));
        canvas.addEventListener('pointermove', this.pointerMove.bind(this));
        canvas.addEventListener('pointerup', this.pointerUp.bind(this));
        canvas.addEventListener('pointercancel', this.pointerCancel.bind(this));
    }


    // --------------------------------------------------------------------------------------
    // HTML generation
    // --------------------------------------------------------------------------------------

    addUIHtml(timeline, selector, bgcol, optionStyle, inputStyle, invertZoom, i)
    {
        let html = '';

        if( this.ui.stickyTools & (1<<i) ) {
            const threshold = i ? 'bottom:0px' : 'top:var(--header-height)';
            html = `<div style="position:sticky;${threshold};padding-top:${this.ui.hideHeader ? 0 : 15}px;padding-bottom:10px;margin-top:-${this.ui.hideHeader ? 0 : 15}px;z-index:1;background-color:var(--card-background-color);line-height:0px;">`;
        }

        html += `<div style="margin-left:0px;width:100%;min-height:30px;text-align:center;display:block;line-height:normal;">`;

        const eh = `<a id="eh_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>`;

        if( timeline ) html += `
            <div id="dl_${i}" style="background-color:${bgcol};float:left;margin-left:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                <button id="b1_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
                <button id="bx_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <button id="b2_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
            </div>`;

        if( selector && isMobile ) html += `
            <div id='sl_${i}' style="background-color:${bgcol};display:none;padding-left:10px;padding-right:10px;">
                <input id="b7_${i}" ${inputStyle} autoComplete="on"/>
                <div id="es_${i}" style="display:none;position:absolute;text-align:left;min-width:260px;max-height:150px;overflow:auto;border:1px solid #444;z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)"></div>
                <button id="b8_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:34px;margin-left:5px;">+</button>
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                <div id="eo_${i}" style="display:none;position:absolute;text-align:left;min-width:150px;overflow:auto;border:1px solid #ddd;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)">
                    <a id="ef_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    ${this.statistics.enabled ? eh : ''}
                    <a id="eg_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    <a id="ei_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                </div>
            </div>`;

        if( selector && !isMobile ) html += `
            <div id='sl_${i}' style="background-color:${bgcol};display:none;padding-left:10px;padding-right:10px;">
                <input id="b7_${i}" ${inputStyle} autoComplete="on" list="b6_${this.cid}" placeholder="Type to search for an entity to add"/>
                <button id="b8_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:34px;margin-left:5px;">+</button>
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                <div id="eo_${i}" style="display:none;position:absolute;text-align:left;min-width:150px;overflow:auto;border:1px solid #ddd;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)">
                    <a id="ef_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    ${this.statistics.enabled ? eh : ''}
                    <a id="eg_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    <a id="ei_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                </div>
            </div>`;

        if( timeline ) html += `
            <div id="dr_${i}" style="background-color:${bgcol};float:right;margin-right:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                <button id="bz_${i}" style="border:0px solid black;color:inherit;background-color:#00000000"><svg width="24" height="24" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" /></svg></button>
                <button id="b${invertZoom ? 5 : 4}_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <select id="by_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;max-width:83px">
                    <option value="0" ${optionStyle} hidden></option>
                    <option value="1" ${optionStyle}></option>
                    <option value="2" ${optionStyle}></option>
                    <option value="3" ${optionStyle} hidden></option>
                    <option value="4" ${optionStyle} hidden></option>
                    <option value="5" ${optionStyle} hidden></option>
                    <option value="6" ${optionStyle}></option>
                    <option value="7" ${optionStyle} hidden></option>
                    <option value="8" ${optionStyle} hidden></option>
                    <option value="9" ${optionStyle} hidden></option>
                    <option value="10" ${optionStyle} hidden></option>
                    <option value="11" ${optionStyle} hidden></option>
                    <option value="12" ${optionStyle}></option>
                    <option value="24" ${optionStyle}></option>
                    <option value="48" ${optionStyle}></option>
                    <option value="72" ${optionStyle}></option>
                    <option value="96" ${optionStyle} hidden></option>
                    <option value="120" ${optionStyle} hidden></option>
                    <option value="144" ${optionStyle} hidden></option>
                    <option value="168" ${optionStyle}></option>
                    <option value="336" ${optionStyle}></option>
                    <option value="504" ${optionStyle}></option>
                    <option value="720" ${optionStyle}></option>
                    <option value="2184" ${optionStyle}></option>
                    <option value="4368" ${optionStyle}></option>
                </select>
                <button id="b${invertZoom ? 4 : 5}_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px">+</button>
            </div>`;

        html += `</div>`;

        html += `<div id='rf_${i}' style="margin-left:0px;margin-top:10px;margin-bottom:0px;width:100%;text-align:center;display:none;line-height:normal;"></div>`;

        if( this.ui.stickyTools & (1<<i) ) html += `</div>`;

        return html;
    }

    insertUIHtmlText(i)
    {
        let ef = this._this.querySelector(`#ef_${i}`); if( ef ) ef.innerHTML = i18n('ui.menu.export_csv');
        let eh = this._this.querySelector(`#eh_${i}`); if( eh ) eh.innerHTML = i18n('ui.menu.export_stats');
        let eg = this._this.querySelector(`#eg_${i}`); if( eg ) eg.innerHTML = i18n('ui.menu.remove_all');
        let ei = this._this.querySelector(`#ei_${i}`); if( ei ) ei.innerHTML = infoPanelEnabled ? i18n('ui.menu.disable_panel') : i18n('ui.menu.enable_panel');
        let b7 = this._this.querySelector(`#b7_${i}`); if( b7 ) b7.placeholder = i18n('ui.label.type_to_search');
        let by = this._this.querySelector(`#by_${i}`); 
        if( by ) {
            by.children[0].innerHTML = i18n('ui.ranges.l_hour');
            by.children[1].innerHTML = i18n('ui.ranges.hour');
            by.children[2].innerHTML = i18n('ui.ranges.n_hours', 2);
            by.children[3].innerHTML = i18n('ui.ranges.n_hours', 3);
            by.children[4].innerHTML = i18n('ui.ranges.n_hours', 4);
            by.children[5].innerHTML = i18n('ui.ranges.n_hours', 5);
            by.children[6].innerHTML = i18n('ui.ranges.n_hours', 6);
            by.children[7].innerHTML = i18n('ui.ranges.n_hours', 7);
            by.children[8].innerHTML = i18n('ui.ranges.n_hours', 8);
            by.children[9].innerHTML = i18n('ui.ranges.n_hours', 9);
            by.children[10].innerHTML = i18n('ui.ranges.n_hours', 10);
            by.children[11].innerHTML = i18n('ui.ranges.n_hours', 11);
            by.children[12].innerHTML = i18n('ui.ranges.n_hours', 12);
            by.children[13].innerHTML = i18n('ui.ranges.day');
            by.children[14].innerHTML = i18n('ui.ranges.n_days', 2);
            by.children[15].innerHTML = i18n('ui.ranges.n_days', 3);
            by.children[16].innerHTML = i18n('ui.ranges.n_days', 4);
            by.children[17].innerHTML = i18n('ui.ranges.n_days', 5);
            by.children[18].innerHTML = i18n('ui.ranges.n_days', 6);
            by.children[19].innerHTML = i18n('ui.ranges.week');
            by.children[20].innerHTML = i18n('ui.ranges.n_weeks', 2);
            by.children[21].innerHTML = i18n('ui.ranges.n_weeks', 3);
            by.children[22].innerHTML = i18n('ui.ranges.month');
            by.children[23].innerHTML = i18n('ui.ranges.n_months', 3);
            by.children[24].innerHTML = i18n('ui.ranges.n_months', 6);
        }
    }

    resize()
    {
        const w = this._this.querySelector('#maincard').clientWidth;

        if( Math.abs(this.lastWidth - w) > 2 ) {
            const tickChanged = this.computeTickDensity(w) != this.computeTickDensity(this.lastWidth);
            this.lastWidth = w;
            for( let g of this.graphs ) g.chart.resize(undefined, g.graphHeight);
            if( tickChanged ) this.setStepSize(true);
        }        

        this.resizeSelector();
    }

    adjustSelectorPosition(reflow, i)
    {
        const rfdiv = this._this.querySelector(`#rf_${i}`);
        const selector = this._this.querySelector(`#sl_${i}`);

        selector.style.display = 'inline-block';

        const isReflown = rfdiv.style.display !== 'none';

        if( !reflow && isReflown ) {
            rfdiv.style.display = 'none';     
            const anchor = this._this.querySelector(`#dl_${i}`);
            anchor.after(selector);
        } else if( reflow && !isReflown ) {
            rfdiv.style.display = 'block';
            rfdiv.appendChild(selector);
        }
    }

    resizeSelector()
    {
        const button_size = 120;
        const min_selector_size = 220;
        const max_selector_size = 500;

        const w = this._this.querySelector('#maincard').clientWidth;

        for( let i = 0; i < 2; ++i ) {
            const input = this._this.querySelector(`#b7_${i}`);
            if( input ) {
                let xw = w - button_size - (this._this.querySelector(`#dl_${i}`)?.clientWidth ?? 0) - (this._this.querySelector(`#dr_${i}`)?.clientWidth ?? 0);
                const reflow = ( xw < min_selector_size && this._this.querySelector(`#dl_${i}`) != null );
                this.adjustSelectorPosition(reflow, i);
                if( !reflow ) {
                    xw = Math.min(xw, max_selector_size);
                    input.style.width = xw + "px";
                } else
                    input.style.width = (w - 108) + "px";
            }
        }
    }

    createContent()
    {
        // Initialize the content if it's not there yet.
        if( !this.contentValid ) {

            this.contentValid = true;

            for( let i = 0; i < 2; i++ )
                this.insertUIHtmlText(i);

            this.ui.darkMode = (this._hass.selectedTheme && this._hass.selectedTheme.dark) || (this._hass.themes && this._hass.themes.darkMode);
            if( this._this.config.uimode ) {
                if( this._this.config.uimode === 'dark' ) this.ui.darkMode = true; else
                if( this._this.config.uimode === 'light' ) this.ui.darkMode = false;
            }

            this.pconfig.graphLabelColor = parseColor(this._this.config.uiColors?.labels ?? (this.ui.darkMode ? '#9b9b9b' : '#333'));
            this.pconfig.graphGridColor  = parseColor(this._this.config.uiColors?.gridlines ?? (this.ui.darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"));

            this.pconfig.nextDefaultColor = 0;

            this.graphs = [];

            // Add fixed YAML defined graphs
            for( let g of this.pconfig.graphConfig ) this.addFixedGraph(g);

            this.resizeSelector();

            /// 
            for( let i = 0; i < 2; i++ ) {

                this._this.querySelector(`#b1_${i}`)?.addEventListener('click', this.subDay.bind(this), false);
                this._this.querySelector(`#b2_${i}`)?.addEventListener('click', this.addDay.bind(this), false);
                this._this.querySelector(`#b4_${i}`)?.addEventListener('click', this.decZoom.bind(this), false);
                this._this.querySelector(`#b5_${i}`)?.addEventListener('click', this.incZoom.bind(this), false);
                this._this.querySelector(`#b8_${i}`)?.addEventListener('click', this.addEntitySelected.bind(this));
                this._this.querySelector(`#bx_${i}`)?.addEventListener('click', this.todayNoReset.bind(this), false);
                this._this.querySelector(`#bx_${i}`)?.addEventListener('dblclick', this.todayReset.bind(this), false);
                this._this.querySelector(`#by_${i}`)?.addEventListener('change', this.timeRangeSelected.bind(this));
                this._this.querySelector(`#bz_${i}`)?.addEventListener('click', this.toggleZoom.bind(this), false);
                this._this.querySelector(`#ef_${i}`)?.addEventListener('click', this.exportFile.bind(this), false);
                this._this.querySelector(`#eh_${i}`)?.addEventListener('click', this.exportStatistics.bind(this), false);
                this._this.querySelector(`#eg_${i}`)?.addEventListener('click', this.removeAllEntities.bind(this), false);
                this._this.querySelector(`#ei_${i}`)?.addEventListener('click', this.toggleInfoPanel.bind(this), false);
                this._this.querySelector(`#bo_${i}`)?.addEventListener('click', this.menuClicked.bind(this), false);

                if( isMobile ) {
                    this._this.querySelector(`#b7_${i}`)?.addEventListener('focusin', this.entitySelectorFocus.bind(this), true);
                    this._this.querySelector(`#b7_${i}`)?.addEventListener('keyup', this.entitySelectorEntered.bind(this), true);
                }

                this.ui.dateSelector[i] = this._this.querySelector(`#bx_${i}`);
                this.ui.rangeSelector[i] = this._this.querySelector(`#by_${i}`);
                this.ui.zoomButton[i] = this._this.querySelector(`#bz_${i}`);

            }

            if( !isMobile ) 
                this._this.querySelector('#maincard').addEventListener('wheel', this.wheelScrolled.bind(this), { passive: false }); 

            this.readLocalState();

            this.pconfig.nextDefaultColor = 0;
            
            // Add dynamically added graphs
            if( this.pconfig.entities ) {
                for( let e of this.pconfig.entities ) this.addDynamicGraph(e);
            } else
                this.pconfig.entities = [];

            this.setTimeRangeFromString(String(this.pconfig.defaultTimeRange));

            this.today(false);

            // Register observer to resize the graphs whenever the maincard dimensions change
            let ro = new ResizeObserver(entries => { this.resize(); });
            ro.observe(this._this.querySelector('#maincard'));

            // Update the info panel config in the browser local storage to sync with the YAML
            this.writeInfoPanelConfig();

        }
    }

    updateContent()
    {
        if( !this.contentValid ) {
            let width = this._this.querySelector('#maincard').clientWidth;
            if( width > 0 ) {
                clearInterval(this.iid);
                this.createContent();
                this.iid = null;
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Entity option dropdown menu
    // --------------------------------------------------------------------------------------

    menuSetVisibility(idx, show)
    {
        const dropdown = this._this.querySelector(`#eo_${idx}`);
        if( !dropdown ) return;

        if( show ) {
            dropdown.style.display = 'block';
            const w = this._this.querySelector('#maincard').clientWidth - 4;
            let p = this._this.querySelector(`#bo_${idx}`).offsetLeft - 30;
            if( p + dropdown.clientWidth >= w ) {
                p = w - dropdown.clientWidth;
            }
            dropdown.style.left = p + "px";
        } else
            dropdown.style.display = 'none';
    }

    menuClicked(event)
    {
        if( !event.currentTarget ) return;
        const idx = event.currentTarget.id.substr(3) * 1;
        this.menuSetVisibility(idx, this._this.querySelector(`#eo_${idx}`)?.style.display == 'none');
    }


    // --------------------------------------------------------------------------------------
    // Alternative compact dropdown list implementation for mobile browsers and apps
    // --------------------------------------------------------------------------------------

    setDropdownVisibility(input_idx, show)
    {
        let input = this._this.querySelector(`#b7_${input_idx}`);
        let dropdown = this._this.querySelector(`#es_${input_idx}`);
        if( !input || !dropdown ) return;
        if( show ) {
            dropdown.style['min-width'] = input.clientWidth + 'px';
            dropdown.style.display = 'block';
            for( let i of dropdown.getElementsByTagName('a') ) i.style.display = 'block';
        } else
            dropdown.style.display = 'none';
    }

    entitySelectorFocus(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;

        this.setDropdownVisibility(idx ^ 1, false);
        this.setDropdownVisibility(idx, true);

        this.focusClick = true;

        if( !this.focusListener ) {
            this.focusListener = true;
            window.addEventListener('click', this.defocusCall);
        }
    }

    entitySelectorDefocus(event)
    {
        if( !this.focusClick ) {
            window.removeEventListener('click', this.defocusCall);
            this.focusListener = undefined;
            this.setDropdownVisibility(0, false);
            this.setDropdownVisibility(1, false);
        } else 
            this.focusClick = undefined;
    }

    entitySelectorEntered(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;

        let dropdown = this._this.querySelector(`#es_${idx}`);
        let input = this._this.querySelector(`#b7_${idx}`);
        let filter = input.value.toLowerCase();
        let tags = dropdown.getElementsByTagName('a');
        for( let i of tags ) {
            let txt = i.textContent;
            if( txt.toLowerCase().indexOf(filter) >= 0 )
                i.style.display = 'block';
            else
                i.style.display = 'none';
        }
    }

    entitySelectorEntryClicked(event)
    {
        window.removeEventListener('click', this.defocusCall);
        this.focusListener = undefined;
        const idx = event.target.href.slice(-1);
        let input = this._this.querySelector(`#b7_${idx}`);
        let dropdown = this._this.querySelector(`#es_${idx}`);
        input.value = event.target.id;
        dropdown.style.display = 'none';
    }


    // --------------------------------------------------------------------------------------
    // Entity listbox populators
    // --------------------------------------------------------------------------------------

    entityCollectorCallback(result)
    { 
        for( let i = 0; i < (isMobile ? 2 : 1); ++i ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${i}` : `#b6_${this.cid}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            const regex = this.pconfig.filterEntities ? this.matchWildcardPattern(this.pconfig.filterEntities) : undefined;

            for( let r of result ) {
                if( regex && !regex.test(r[0].entity_id) ) continue;
                let o;
                if( isMobile ) {
                    o = document.createElement('a');
                    o.href = `#s_${i}`;
                    o.id = r[0].entity_id;
                    o.style = "display:block;padding:2px 5px;text-decoration:none;color:inherit";
                    o.addEventListener('click', this.entitySelectorEntryClicked.bind(this), true);
                } else 
                    o = document.createElement('option');
                o.innerHTML = r[0].entity_id;
                datalist.appendChild(o);
            }

        }

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.type_to_search");
    }

    entityCollectorFailed(error) 
    {
        console.log(error);

        this.entityCollectAll();

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.error_retreiving");
    }

    entityCollectAll()
    {
        for( let i = 0; i < (isMobile ? 2 : 1); ++i ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${i}` : `#b6_${this.cid}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            const regex = this.pconfig.filterEntities ? this.matchWildcardPattern(this.pconfig.filterEntities) : undefined;

            for( let e in this._hass.states ) {
                if( regex && !regex.test(e) ) continue;
                const d = this.getDomainForEntity(e);
                if( !['automation', 'script', 'zone', 'camera', 'persistent_notification', 'timer'].includes(d) ) {
                    let o;
                    if( isMobile ) {
                        o = document.createElement('a');
                        o.href = `#s_${i}`;
                        o.id = e;
                        o.style = "display:block;padding:2px 5px;text-decoration:none;color:inherit";
                        o.addEventListener('click', this.entitySelectorEntryClicked.bind(this), true);
                    } else 
                        o = document.createElement('option');
                    o.innerHTML = e;
                    datalist.appendChild(o);
                }
            }

        }
    }

    requestEntityCollection()
    {
        if( this.entitiesPopulated ) return;

        this.entitiesPopulated = true;

        this.ui.inputField[0] = this._this.querySelector(`#b7_0`);
        this.ui.inputField[1] = this._this.querySelector(`#b7_1`);

        if( this.pconfig.recordedEntitiesOnly ) {
            for( let i of this.ui.inputField )
                if( i ) i.placeholder = i18n("ui.label.loading");
            const t0 = moment().subtract(1, "hour").format('YYYY-MM-DDTHH:mm:ss');
            const url = `history/period/${t0}?minimal_response&no_attributes`;
            this.callHassAPIGet(url).then(this.entityCollectorCallback.bind(this), this.entityCollectorFailed.bind(this));
        } else
            this.entityCollectAll();

    }


    // --------------------------------------------------------------------------------------
    // Localization
    // --------------------------------------------------------------------------------------

    initLocalization()
    {
        if( this.i18n.valid ) return;

        let locale = this._hass.language ? this._hass.language : 'en-GB';

        setLanguage(locale);

        this.i18n.styleDateSelector = getLocalizedDateString(locale, { dateStyle: 'medium' });
        this.i18n.styleDateTicks = ( this.i18n.styleDateSelector[0] == 'D' ) ? 'D MMM' : 'MMM D';

        if( this._hass.locale?.time_format === '24' ) locale = 'en-GB';
        if( this._hass.locale?.time_format === '12' ) locale = 'en-US';

        this.i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
        this.i18n.styleDateTimeTooltip = this.i18n.styleDateTicks + ', ' + getLocalizedDateString(locale, { timeStyle: 'medium' });

        this.i18n.valid = true;
    }


    // --------------------------------------------------------------------------------------
    // Hass API access
    // --------------------------------------------------------------------------------------

    callHassAPIGet(url)
    {
        return this._hass.callApi('GET', url);
    }


    // --------------------------------------------------------------------------------------
    // Dynamic data storage
    // --------------------------------------------------------------------------------------

    writeLocalState()
    {
        const data = { "version" : 1, "entities" : this.pconfig.entities };

        window.localStorage.removeItem('history-explorer-card');
        window.localStorage.removeItem('history-explorer_card_' + this.id);
        window.localStorage.setItem('history-explorer_card_' + this.id, JSON.stringify(data));
    }

    readLocalState()
    {
        let data = JSON.parse(window.localStorage.getItem('history-explorer_card_' + this.id));

        if( data && data.version === 1 ) {
            this.pconfig.entities = data.entities;
        } else {
            data = JSON.parse(window.localStorage.getItem('history-explorer-card'));
            if( data ) 
                this.pconfig.entities = data;
            else
                this.pconfig.entities = [];
        }
    }

    writeInfoPanelConfig(forceUpdate = false)
    {
        if( !infoPanelEnabled ) {
            window.localStorage.removeItem('history-explorer-info-panel');
        } else if( infoPanelEnabled && (this.pconfig.infoPanelConfig || forceUpdate) ) {
            let data = {};
            data.enabled = true;
            data.config = this.pconfig.infoPanelConfig;
            window.localStorage.removeItem('history-explorer-info-panel');
            window.localStorage.setItem('history-explorer-info-panel', JSON.stringify(data));
        }
    }
}


// --------------------------------------------------------------------------------------
// Get time and date formating strings for a given locale
// --------------------------------------------------------------------------------------

function isSingleSymbol(s)
{
    return s.length == 1 && s[0].toLowerCase() == s[0].toUpperCase();
}

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
            default: return ( ['.', ',', '/', '-'].includes(part.value) || !isSingleSymbol(part.value) ) ? ' ' : part.value;
        }
    }).join("");
}


// --------------------------------------------------------------------------------------
// Main card custom HTML element
// --------------------------------------------------------------------------------------

var gcid = 0;

class HistoryExplorerCard extends HTMLElement 
{
    instance = null;

    // Whenever the state changes, a new `hass` object is set. Use this to update your content.
    set hass(hass) 
    {
        this.instance._this = this;
        this.instance._hass = hass;

        if( !this.instance.entitiesPopulated )
            this.instance.requestEntityCollection();

        if( !this.instance.i18n.valid )
            this.instance.initLocalization();

        if( !this.instance.contentValid && !this.instance.iid )
            this.instance.iid = setInterval(this.instance.updateContent.bind(this.instance), 100);

    }

    set panel(panel)
    {
        this.setConfig(panel.config);
    }

    // The user supplied configuration. Throw an exception and Lovelace will render an error card.
    setConfig(config) 
    {
        this.config = config;

        if( !this.instance )
            this.instance = new HistoryCardState();

        this.instance.g_id = 0;

        this.instance.pconfig.graphConfig = [];

        if( config.graphs ) {
            for( let i = 0; i < config.graphs.length; i++ ) {
                for( let e of config.graphs[i].entities ) {
                    if( !e.entity ) throw new Error(`Invalid entity ${e.entity}`);
                }
                this.instance.pconfig.graphConfig.push({ graph: config.graphs[i], id:this.instance.g_id++ });
            }
        }

        this.instance.firstDynamicId = this.instance.g_id;

        this.instance.pconfig.customStateColors = {};

        if( config.stateColors ) {
            for( let i in config.stateColors ) {
                this.instance.pconfig.customStateColors[i] = parseColor(config.stateColors[i]);
            }
        }

        this.instance.pconfig.entityOptions = config.entityOptions;

        this.instance.pconfig.labelAreaWidth =         config.labelAreaWidth ?? 65;
        this.instance.pconfig.labelsVisible =          config.labelsVisible ?? true;
        this.instance.pconfig.showTooltipColors[0] =   config.showTooltipColorsLine ?? true;
        this.instance.pconfig.showTooltipColors[1] =   config.showTooltipColorsTimeline ?? true;
        this.instance.pconfig.tooltipSize =            config.tooltipSize ?? 'auto';
        this.instance.pconfig.tooltipShowDuration =    config.tooltipShowDuration ?? false;
        this.instance.pconfig.colorSeed =              config.stateColorSeed ?? 137;
        this.instance.pconfig.stateTextMode =          config.stateTextMode ?? 'raw';
        this.instance.pconfig.enableDataClustering = ( config.decimation === undefined ) || config.decimation;
        this.instance.pconfig.roundingPrecision =      config.rounding || 2;
        this.instance.pconfig.defaultLineMode =        config.lineMode;
        this.instance.pconfig.showUnavailable =        config.showUnavailable ?? false;
        this.instance.pconfig.axisAddMarginMin =     ( config.axisAddMarginMin !== undefined ) ? config.axisAddMarginMin : true;
        this.instance.pconfig.axisAddMarginMax =     ( config.axisAddMarginMax !== undefined ) ? config.axisAddMarginMax : true;
        this.instance.pconfig.recordedEntitiesOnly =   config.recordedEntitiesOnly ?? false;
        this.instance.pconfig.filterEntities  =        config.filterEntities;
        this.instance.pconfig.combineSameUnits =       config.combineSameUnits === true;
        this.instance.pconfig.defaultTimeRange =       config.defaultTimeRange ?? '24';
        this.instance.pconfig.timeTickDensity =        config.timeTickDensity ?? 'high';
        this.instance.pconfig.lineGraphHeight =      ( config.lineGraphHeight ?? 250 ) * 1;
        this.instance.pconfig.barGraphHeight =       ( config.barGraphHeight ?? 150 ) * 1;
        this.instance.pconfig.exportSeparator =        config.csv?.separator;
        this.instance.pconfig.exportTimeFormat =       config.csv?.timeFormat;
        this.instance.statistics.enabled =             config.statistics?.enabled ?? false;
        this.instance.statistics.mode =                config.statistics?.mode ?? 'mean';
        this.instance.statistics.retention =           config.statistics?.retention ?? undefined;

        this.instance.pconfig.closeButtonColor = parseColor(config.uiColors?.closeButton ?? '#0000001f');

        this.instance.pconfig.infoPanelConfig = config.infoPanel;

        this.instance.id = config.cardName ?? "default";
        this.instance.cid = gcid++;

        this.instance.contentValid = false;
        this.instance.entitiesPopulated = false;

        const header = config.header || "History explorer";
        const bgcol = parseColor(config.uiColors?.buttons ?? getComputedStyle(document.body).getPropertyValue('--primary-color') + '1f');

        const bitmask = { 'hide': 0, 'top': 1, 'bottom': 2, 'both': 3 };
        const tools = bitmask[config.uiLayout?.toolbar] ?? 1;
        const selector = bitmask[config.uiLayout?.selector] ?? 2;
        this.instance.ui.stickyTools = bitmask[config.uiLayout?.sticky] ?? 0;

        const invertZoom = config.uiLayout?.invertZoom === true;

        const optionStyle = `style="color:var(--primary-text-color);background-color:var(--card-background-color)"`;
        const inputStyle = config.uiColors?.selector ? `style="color:var(--primary-text-color);background-color:${config.uiColors.selector};border:1px solid black;"` : '';

        this.instance.ui.optionStyle = optionStyle;
        this.instance.ui.hideHeader = header === 'hide';

        // Generate card html

        // Header
        let html = `
            <ha-card id="maincard" header="${this.instance.ui.hideHeader ? '' : header}">
            ${this.instance.addUIHtml(tools & 1, selector & 1, bgcol, optionStyle, inputStyle, invertZoom, 0)}
            <div id='graphlist' class='card-content' style='margin-top:${(this.instance.ui.stickyTools & 1) ? '0px' : '8px'};'>
        `;

        // Graph area
        let spacing = true;
        for( let g of this.instance.pconfig.graphConfig ) {
            if( g.id > 0 && spacing ) html += '<br>';
            if( g.graph.title !== undefined ) html += `<div style='text-align:center;'>${g.graph.title}</div>`;
            const h = this.instance.calcGraphHeight(g.graph.type, g.graph.entities.length);
            html += `<div style='height:${h}px'>`;
            html += `<canvas id="graph${g.id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
            if( g.graph.type == 'bar' ) 
                html += this.instance.createIntervalSelectorHtml(g.id, h, this.instance.parseIntervalConfig(g.graph.options?.interval), optionStyle);
            html += `</div>`;
            spacing = !( g.graph.options?.showTimeLabels === false );
        }

        // Footer
        html += `
            </div>
            ${this.instance.addUIHtml(tools & 2, selector & 2, bgcol, optionStyle, inputStyle, invertZoom, 1)}
            ${(((tools | selector) & 2) && !(this.instance.ui.stickyTools & 2)) ? '<br>' : ''}
            <datalist id="b6_${this.instance.cid}"></datalist>
            </ha-card>
        `;

        this.innerHTML = html;

        // Processing spinner (not added to DOM by default)
        this.instance.ui.spinOverlay = document.createElement('div');
        this.instance.ui.spinOverlay.style = 'position:fixed;display:block;width:100%;height:100%;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.5);z-index:2;backdrop-filter:blur(5px)';
        this.instance.ui.spinOverlay.innerHTML = `<svg width="38" height="38" viewBox="0 0 38 38" stroke="#fff" style="position:fixed;left:calc(50% - 20px);top:calc(50% - 20px);"><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle stroke-opacity="0.5" cx="18" cy="18" r="18"/><path d="M36 18c0-9.94-8.06-18-18-18"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/></path></g></g></svg>`;

    }

    // The height of your card. Home Assistant uses this to automatically distribute all cards over the available columns.
    getCardSize() 
    {
        return 3;
    }

    static getStubConfig() 
    {
        return { "cardName": "historycard-" + Math.floor(Math.random() * 99999999 + 1) };
    }

}

console.info(`%c HISTORY-EXPLORER-CARD %c Version ${Version}`, "color:white;background:blue;font-weight:bold", "color:black;background:white;font-weight:bold");

customElements.define('history-explorer-card', HistoryExplorerCard);

window.customCards = window.customCards || [];
window.customCards.push({ type: 'history-explorer-card', name: 'History Explorer Card', preview: false, description: 'An interactive history viewer card'});
