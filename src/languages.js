
// --------------------------------------------------------------------------------------
// English (en_us, en_gb, en)
// --------------------------------------------------------------------------------------

const lang_en =
{
    "ui" : {
        "label" : {
            "type_to_search" : "Type to search for an entity to add",
            "error_retreiving" : "Could not retrieve available entities !",
            "loading" : "Loading available entities...",
        }, 
        "popup" : {
            "remove_all" : "Remove all dynamically added graphs ?",
        },
        "menu" : {  
            "export_csv" : "Export as CSV",
            "remove_all" : "Remove all added graphs"
        },
        "ranges" : {
            "l_hour" : "< 1 H",
            "hour" : "1 H",
            "n_hours" : "%1 H",
            "day" : "1 Day",
            "n_days" : "%1 Days",
            "week" : "1 Week",
            "n_weeks" : "%1 Weeks",
            "month" : "1 Month",
            "n_months" : "%1 Months"
        },
        "interval" : {
            "_10m" : "10 min",
            "hourly" : "Hourly",
            "daily" : "Daily"
        }
    }
}


// --------------------------------------------------------------------------------------
// French (fr)
// --------------------------------------------------------------------------------------

const lang_fr =
{
    "ui" : {
        "label" : {
            "type_to_search" : "Tapez ici pour rechercher une entité à ajouter",
            "error_retreiving" : "Impossible de récupérer les entités !",
            "loading" : "Chargement des entités disponibles...",
        }, 
        "popup" : {
            "remove_all" : "Supprimer tous les graphiques ajoutés dynamiquement ?",
        },
        "menu" : {  
            "export_csv" : "Exporter le CSV",
            "remove_all" : "Supprimer tous les graphiques"
        },
        "ranges" : {
            "l_hour" : "< 1 H",
            "hour" : "1 H",
            "n_hours" : "%1 H",
            "day" : "1 Jour",
            "n_days" : "%1 Jours",
            "week" : "1 Sem",
            "n_weeks" : "%1 Sem",
            "month" : "1 Mois",
            "n_months" : "%1 Mois"
        },
        "interval" : {
            "_10m" : "10 min",
            "hourly" : "Heure",
            "daily" : "Journée"
        }
    }
}


// --------------------------------------------------------------------------------------
// German (de)
// --------------------------------------------------------------------------------------


const lang_de =
{
    "ui" : {
        "label" : {
            "type_to_search" : "Entität suchen oder auswählen",
            "error_retreiving" : "Entitäten konnten nicht geladen werden !",
            "loading" : "Lade verfügbare Entitäten...",
        }, 
        "popup" : {
            "remove_all" : "Alle dynamisch hinzugefügten Diagramme entfernen ?",
        },
        "menu" : {  
            "export_csv" : "Als CSV exportieren",
            "remove_all" : "Alle Diagramme entfernen"
        },
        "ranges" : {
            "l_hour" : "< 1 Std",
            "hour" : "1 Stunde",
            "n_hours" : "%1 Stdn.",
            "day" : "1 Tag",
            "n_days" : "%1 Tage",
            "week" : "1 Woche",
            "n_weeks" : "%1 Wo.",
            "month" : "1 Monat",
            "n_months" : "%1 Monate"
        },
        "interval" : {
            "_10m" : "10 Min",
            "hourly" : "Stündlich",
            "daily" : "Täglich"
        }
    }
}


// --------------------------------------------------------------------------------------
// Spanish (es)
// --------------------------------------------------------------------------------------

const lang_es =
{
    "ui" : {
        "label" : {
            "type_to_search" : "Seleccionar entidad a añadir",
            "error_retreiving" : "No se encuentran entidades disponibles!",
            "loading" : "Cargando entidades ...",
        }, 
        "popup" : {
            "remove_all" : "Borrar gráficos añadidos dinámicamente ?",
        },
        "menu" : {  
            "export_csv" : "Exportar como CSV",
            "remove_all" : "Borrar gráficos añadidos"
        },
        "ranges" : {
            "l_hour" : "< 1 H",
            "hour" : "1 H",
            "n_hours" : "%1 H",
            "day" : "1 Día",
            "n_days" : "%1 Días",
            "week" : "1 Sem.",
            "n_weeks" : "%1 Sem.",
            "month" : "1 Mes",
            "n_months" : "%1 Meses"
        },
        "interval" : {
            "_10m" : "10 min",      // TODO !
            "hourly" : "Hourly",    // TODO !
            "daily" : "Daily"       // TODO !
        }
    }
}


// --------------------------------------------------------------------------------------
// Language localization helper functions
// --------------------------------------------------------------------------------------

var languages = {
    'en': lang_en,
    'fr': lang_fr,
    'de': lang_de,
    'es': lang_es
};

var language = 'en';

function setLanguage(l)
{
    language = 'en';
    let lang = l.replace('-', '_').split('_');
    if( lang && lang.length > 0 && languages[lang[0]] ) language = lang[0];
}

function i18n(t, a0)
{
    let v = t.split('.').reduce((o,i) => o[i], languages[language]);
    if( v === undefined ) 
        v = t.split('.').reduce((o,i) => o[i], languages['en']);
    if( v && a0 ) v = v.replace('%1', a0);
    return v;
}


