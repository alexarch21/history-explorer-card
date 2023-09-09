
// --------------------------------------------------------------------------------------
// Export CSV : history DB
// --------------------------------------------------------------------------------------

class HistoryCSVExporter {

    constructor() 
    {
        this.overlay = null;
        this.separator = undefined;
        this.timeFormat = undefined;
        this.saveAttributes = undefined;
        this._hass = null;
    }

    exportCallback(result)
    { 
        let data = [];
        let attributes = [];

        data.push(`Time stamp${this.separator}State\r\n`);

        for( let entity in result ) {

            const r = result[entity];
            if( !r.length ) continue;

            let v = entity;

            if( this.saveAttributes ) {
                attributes = [];
                if( this._hass.states[entity] ) {
                    v += `${this.separator}State`;
                    for( let a in this._hass.states[entity].attributes ) {
                        if( !_STATE_ATTRIBUTES.includes(a) ) {
                            attributes.push(a);
                            v += `${this.separator}${a}`;
                        }
                    }
                }
            }

            data.push(v + "\r\n");

            for( let e of r ) {
                const t = moment(e.lu * 1000).format(this.timeFormat);
                let v = t + this.separator + e.s;
                if( this.saveAttributes ) {
                    for( let a of attributes ) {
                        v += this.separator + (e.a ? e.a[a] : '');
                    }
                }
                data.push(v + "\r\n");
            }

        }

        const blob = new Blob(data, { type: "text/plain;charset=utf-8"});

        document.body.removeChild(this.overlay);

        saveAs(blob, "entities-" + moment().format('YYYY-MM-DD_HH:mm:ss') + ".csv");
    }

    exportFailed(error) 
    {
        document.body.removeChild(this.overlay);

        console.log(error);
    }

    exportFile(cardstate)
    {
        this.separator = cardstate.pconfig.exportSeparator ?? ',';
        this.timeFormat = cardstate.pconfig.exportTimeFormat ?? 'YYYY-MM-DD HH:mm:ss';
        this.saveAttributes = cardstate.pconfig.exportAttributes;

        this._hass = cardstate._hass;

        let n = 0;

        let t0 = cardstate.startTime.replace('+', '%2b');
        let t1 = cardstate.endTime.replace('+', '%2b');
        let l = [];
        for( let g of cardstate.graphs ) {
            for( let e of g.entities ) {
                l.push(e.entity);
                n++;
            }
        }

        if( n > 0 ) {

            this.overlay = cardstate.ui.spinOverlay;
            document.body.appendChild(this.overlay);

            // Issue statistics retrieval call
            let d = { 
                type: "history/history_during_period",
                start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
                end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
                minimal_response: !this.saveAttributes,
                no_attributes: !this.saveAttributes,
                entity_ids: l
            };
            cardstate._hass.callWS(d).then(this.exportCallback.bind(this), this.exportFailed.bind(this));

        }
    }

}


// --------------------------------------------------------------------------------------
// Export CSV : statistics DB
// --------------------------------------------------------------------------------------

class StatisticsCSVExporter {

    constructor() 
    {
        this.overlay = null;
        this.separator = undefined;
        this.timeFormat = undefined;
    }

    exportCallback(result)
    { 
        let data = [];

        data.push(`Time stamp${this.separator}State${this.separator}Mean${this.separator}Min${this.separator}Max\r\n`);

        for( let entity in result ) {
            const r = result[entity];
            if( !r.length ) continue;
            data.push(entity + "\r\n");
            for( let e of r ) {
                const t = moment(e.start).format(this.timeFormat);
                data.push(t + this.separator + (e.state ?? '') + this.separator + (e['mean'] ?? '') + this.separator + (e['min'] ?? '') + this.separator + (e['max'] ?? '') + "\r\n");
            }
        }

        const blob = new Blob(data, { type: "text/plain;charset=utf-8"});

        document.body.removeChild(this.overlay);

        saveAs(blob, "entities-" + moment().format('YYYY-MM-DD_HH:mm:ss') + ".csv");
    }

    exportFailed(error) 
    {
        document.body.removeChild(this.overlay);

        console.log(error);
    }

    exportFile(cardstate)
    {
        this.separator = cardstate.pconfig.exportSeparator ?? ',';
        this.timeFormat = cardstate.pconfig.exportTimeFormat ?? 'YYYY-MM-DD HH:mm:ss';

        let n = 0;

        let t0 = cardstate.startTime.replace('+', '%2b');
        let t1 = cardstate.endTime.replace('+', '%2b');
        let l = [];
        for( let g of cardstate.graphs ) {
            for( let e of g.entities ) {
                l.push(e.entity);
                n++;
            }
        }

        if( n > 0 ) {

            this.overlay = cardstate.ui.spinOverlay;
            document.body.appendChild(this.overlay);

            // Issue statistics retrieval call
            let d = { 
                type: ( cardstate.version[0] > 2022 || cardstate.version[1] >= 11 ) ? "recorder/statistics_during_period" : "history/statistics_during_period",
                start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
                end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
                period: cardstate.pconfig.exportStatsPeriod ?? 'hour',
                statistic_ids: l
            };
            cardstate._hass.callWS(d).then(this.exportCallback.bind(this), this.exportFailed.bind(this));

        }
    }

}


// --------------------------------------------------------------------------------------
// HA core built-in state attributes
// --------------------------------------------------------------------------------------

var _STATE_ATTRIBUTES = [
    "entity_id",
    "assumed_state",
    "attribution",
    "custom_ui_more_info",
    "custom_ui_state_card",
    "device_class",
    "editable",
    "emulated_hue_name",
    "emulated_hue",
    "entity_picture",
    "friendly_name",
    "haaska_hidden",
    "haaska_name",
    "icon",
    "initial_state",
    "last_reset",
    "restored",
    "state_class",
    "supported_features",
    "unit_of_measurement",
];
