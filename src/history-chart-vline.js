
// --------------------------------------------------------------------------------------
// Chartjs vertical line plugin
// --------------------------------------------------------------------------------------

const vertline_plugin = {

    id: 'vertline',

    afterInit: (chart) => { 
        chart.vertline = { x: 0, draw: false } 
    },

    afterEvent: (chart, evt) => {
        const pconfig = chart.callerInstance.pconfig;
        if( isMobile || pconfig.cursorMode === 'hide' ) return;
        if( !pconfig.cursorTypes.includes('all') && !pconfig.cursorTypes.includes(chart.config.type) ) return;
        const {
            chartArea: { top, bottom, left, right }
        } = chart;
        const s = ( evt.x >= left && evt.x <= right && evt.y >= top && evt.y <= bottom );
        if( pconfig.cursorMode === 'auto' ) {
            chart.vertline = { x: evt.x, draw: s };
            chart.draw();
        } else if( pconfig.cursorMode === 'all' ) {
            for( let g of chart.callerInstance.graphs ) {
                g.chart.vertline = { x: evt.x, draw: s };
                g.chart.draw();
            }
        }
   },

   afterDatasetsDraw: (chart, _, opts) => {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        if( chart.vertline.draw ) {
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = opts.color || 'black';
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chart.vertline.x, bottom);
            ctx.lineTo(chart.vertline.x, top);
            ctx.stroke();
            ctx.restore();
        }
    }

};

