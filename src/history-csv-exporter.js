
// --------------------------------------------------------------------------------------
// Export CSV
// --------------------------------------------------------------------------------------

export default class HistoryCSVExporter {

    constructor() 
    {
        this.overlay = null;
    }

    exportCallback(result)
    { 
        let data = [];

        data.push("Time stamp,State\r\n");

        for( let r of result ) {
            if( !r.length ) continue;
            data.push(r[0].entity_id + "\r\n");
            for( let e of r ) {
                const t = moment(e.last_changed).format('YYYY-MM-DD HH:mm:ss');
                data.push(t + "," + e.state + "\r\n");
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

