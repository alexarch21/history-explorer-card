
// --------------------------------------------------------------------------------------
// Export CSV : history DB
// --------------------------------------------------------------------------------------

class HistoryCSVExporter {

    constructor() 
    {
        this.overlay = null;
        this.separator = undefined;
        this.timeFormat = undefined;
    }

    exportCallback(result)
    { 
        let data = [];

        data.push(`Time stamp${this.separator}State\r\n`);

        for( let r of result ) {
            if( !r.length ) continue;
            data.push(r[0].entity_id + "\r\n");
            for( let e of r ) {
                const t = moment(e.last_changed).format(this.timeFormat);
                data.push(t + this.separator + e.state + "\r\n");
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
        let url = `history/period/${t0}?end_time=${t1}&filter_entity_id`;
        let separator = '=';
        for( let g of cardstate.graphs ) {
            for( let e of g.entities ) {
                url += separator;
                url += e.entity;
                separator = ',';
                n++;
            }
        }

        if( n > 0 ) {

            this.overlay = cardstate.ui.spinOverlay;
            document.body.appendChild(this.overlay);

            const p = cardstate.callHassAPIGet(url);
            p.then(this.exportCallback.bind(this), this.exportFailed.bind(this));

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
            data.push(r[0].statistic_id + "\r\n");
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
                type: "history/statistics_during_period",
                start_time: t0,
                end_time: t1,
                period: "hour",
                statistic_ids: l
            };
            cardstate._hass.callWS(d).then(this.exportCallback.bind(this), this.exportFailed.bind(this));

        }
    }

}

