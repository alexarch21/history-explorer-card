[![hacs_badge](https://img.shields.io/badge/HACS-Default-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

# History explorer card

This is a custom history card for Home Assistant. This card offers a highly interactive and configurable way to view the history of your entities in HA. The card uses asynchronous stream caching and adaptive data decimation to hide the high latency of HA's history database accesses and tries to make it into a smooth interactive experience.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

## Usage

The history explorer card can be configured interactively through the UI or manually through YAML. The card can contain one or multiple charts, every chart can display the history of one or multiple entities. Currently the card supports line charts for numerical entities and timeline charts for non-numerical ones. The order the charts are displayed in the history, as well as the colors used for charts and timeline states are all fully configurable. 

https://user-images.githubusercontent.com/60828821/147440026-13a5ba52-dc43-4ff7-a944-9c2784e4a2f7.mp4

When the card is opened, it will display the history of the configured entities for the last 24 hours starting at the current date and time. On the top left you will find the date selector previous and next buttons, use them to quickly browse through the days. Your can use the right side time range selector (dropdown or plus / minus buttons) to zoom into or out of the history. You can also use the interactive zoom mode (magnifying glass icon) to select a region on a graph to zoom into.

Click or tap on a graph and drag left or right to slide it through time. The card will stream in the database as you move along. If you have a slow DB (like on an SD card), you may see empty parts on the chart that will progressively fill as the data comes in. The larger the shown time range, the more the effect is visible. So scrolling through entire weeks will generate more database accesses than scrolling through days or hours at a time, especially on slower CPUs, like phones.

Once you release the mouse button after dragging (or release your finger from the chart), the card will automatically readjust the y axes on all charts to better reflect the new data. The card will also synchronize all other charts in the history to the same point in time. That way you will always see the same time range on all your data and everything will be aligned.

Like in the native HA history panel, you can hover over the chart line or state timelines to get a tooltip of the selected values or state.

### Data decimation

The card will automatically reduce the data shown in the charts and remove details that would not be visible or useful at a given time range. For example, if you view a per-hour history, nothing will be removed and you will be able to explore the raw data, point by point. If you view an entire week at once, there's no need to show data that changed every few seconds, you couldn't even see it. The card will simplify the curves and make the experience a lot faster that way. 

This feature can be turned off in the options if you want, either globally or by entity.

![history-panel-line-decimation](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-line-decimation.png)

Decimation works on state timelines by merging very small state changes into 'multiple' sections when they can't be seen individually anymore. Zoom into the timeline and the details will appear. The color used for the multiple sections can be adjusted per graph.

![history-panel-timeline-multiple](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-timeline-multiple.png)

## Install and configuration

### HACS

The history explorer card is now part of the default [HACS Home Assistant Community Store](https://hacs.xyz). This is the preferred way to install this card.

### Manual install

 1. Download the `history-explorer-card.js` file and copy it into your `config/www` folder
 2. Add a resource reference to it. On the HA UI, navigate to Configuration -> Dashboards -> Resources. Visit the [Registering resources](https://developers.home-assistant.io/docs/frontend/custom-ui/registering-resources) page on the Home Assistant support site for more information.
 3. Click on the `+ Add Resource` button
 4. Type `/local/history-explorer-card.js` into the URL field and make sure the resource type field says Javascript Module
 5. Hit create

You can now add the card to your dashboard as usual. You may have to refresh the page in your browser once after adding the card to properly initialize it.

### Interactive configuration

The entities visible on the history explorer card can be defined in the card configuration or they can be added or removed on the fly through the card UI without changing the configuration. Both modes can be combined. The entities defined in the YAML will be displayed first and will always be visible when the dashboard is opened. Dynamically added entities will be displayed next. The entities you add or remove over the UI are remembered in your browsers local storage, so you don't to add them every time you reopen the HA page.

You can manage your dynamically configured entities like this:

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

If you want to manage all your entities dynamically, you will need to supply an empty YAML. You can still add global configuration settings.

```yaml
type: custom:history-explorer-card
graphs:
```
By default the UI entity dropdown will list all entities known to HA. This can be a little overwhelming if you have lots. Alternatively the card can only list entities that are actually recorded and available in the database. Doing this will require a database access which can take a few seconds on larger installs. You can use the card normally while the list is loading in the background. The add entity list will become available as soon as the data is loaded. To turn on this mode use the following config in your YAML:

```yaml
type: custom:history-explorer-card
recordedEntitiesOnly: true
```
When the dashboard is opened, the card will show the last 24 hours by default. You can select a different default time range in the YAML. Use m, h, d, and w to denote minutes, hours, days and weeks respectively. If no postfix is given, hours are assumed.

```yaml
type: custom:history-explorer-card
defaultTimeRange: 4h   // show the last 4 hours when opening the card
defaultTimeRange: 2d   // or 2 days...
defaultTimeRange: 15m  // or 15 minutes...
defaultTimeRange: 3w   // or 3 weeks
```

### Grouping multiple entities into a single graph

For line graphs, each dynamically added entity will be displayed in its own graph by default. If you prefer having entities with compatible units of measure grouped into a single graph, then you can override this default behavior with the following YAML setting:

```yaml
type: custom:history-explorer-card
combineSameUnits: true
```
Timeline graphs will always automatically group if possible. Graphs defined manually in the YAML will never auto-group, their grouping can be controlled in the YAML.

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

### Line interpolation modes

Three modes are available for line charts: cubic splines, line segments and stepped. Cubic splines, the default, are the smoothest but can sometimes overshoot after steep gradients followed by longer constant sections. Line segments will connect your data points using straight lines. They are less smooth, but can't overshoot. Stepped mode will show the raw quantized data.

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

You can specify the line mode in the YAML global settings. Possible options are `curves`, `lines` or `stepped`. The default if the option is not present is curves.

```yaml
type: custom:history-explorer-card
lineMode: lines
```

The line mode can also be set for fixed entities defined in the YAML and for dynamic entities or device classes (see below).

A small margin will be added to the top and bottom of line charts, so to give some headroom to curves should they overshoot and make it visually nicer. You can turn off these margins if you don't want the additional space. It's recommended to use lines or stepped mode if you remove both margins to avoid curves overshooting outside of the chart area:

```yaml
type: custom:history-explorer-card
axisAddMarginMin: false
axisAddMarginMax: false
```

### Y axis min and max

By default the min/max scales for the Y axis are adjusted automatically to the data you are currently viewing. You can override the automatic range with your own values for both fixed graphs defined in the YAML, as well as for dynamically added entities or device classes. See the customizing dynamic line graphs section and the advanced YAML example below.

### Rounding

The rounding precision used for displaying data point values on the tooltip in line charts can be defined globally through the `rounding` key followed by the amount of fractional digits. The default is 2 digits.

```yaml
type: custom:history-explorer-card
rounding: 4
```

### Line graphs and unavailable data

If your history data contains an unavailable state, for example if a sensor went offline for a while, then this appears as a gap in the line charts. This way you will be able to easily see when and how often your sensors disconnected or became unavailable. This unavailable state is also shown on timeline charts. If you prefer to not have gaps in your line charts, you can add the following YAML option to hide and interpolate over the unavailable states:

```yaml
type: custom:history-explorer-card
showUnavailable: false
```

### Customizing state colors

The default colors used for the states shown on timeline graphs can be customized in many different ways. Customizing is done by adding the statesColor key to the card YAML. Colors act on device classes, domains or global states. You can, for example, have distinct colors for the on and off states of your motion sensors and your door sensors, even if they're both binary sensors.

The card accepts all normal HTML color definition strings as well as CSS variables. The latter need to be provided as-is (for example `--primary-color`, without the CSS var function).

The following example will turn the *on* state of all door sensors blue and the *on* state of all motion sensors yellow. The *on* state of other sensor device classes will not be affected. They will inherit their colors from either a domain wide or a global color rule, in that order (see below). You specify the device class followed by a dot and the state you'd like to customize:

```yaml
type: custom:history-explorer-card
stateColors:
  door.on: blue
  motion.on: yellow
```

You can also specify state colors for an entire domain. The following example will turn the *off* state for all binary sensors that don't have a color defined for their device class purple and the *home* state of the person domain green:

```yaml
type: custom:history-explorer-card
stateColors:
  binary_sensor.off: purple
  person.home: 'rgb(0,255,0)'
```

Finally, you can color a specific state globally through all device classes and domains. This can be used as a generic fallback. The following example colors the *off* state of all sensors red, as long as they don't have a specific rule for their device class or domain:

```yaml
type: custom:history-explorer-card
stateColors:
  off: '#ff0000'
```

There is a special virtual state that is added to all entities, the *multiple* state. This state substitutes an aggregation of multiple states on the timeline when they were merged due to data decimation. Like normal states, you can specify the color for this special state for device classes, domains or globally.

### Customizing dynamically added line graphs

When you add a new line graph using the add entity dropdown, the graph will use the default settings and an automatically picked color. You can override these settings either for specific entities or for entire device classes. For example, you could set a fixed Y axis range for all your humidity sensors or a specific color or line interpolation mode for your power graphs.

```yaml
type: custom:history-explorer-card
entityOptions:
  humidity:  # Apply these settings to all humidity sensors 
    color: blue
    fill: rgba(0,0,255,0.2)
    ymin: 20
    ymax: 100
    lineMode: lines
  sensor.outside_pressure:  # Apply these settings specifically to this entity if added
    color: green
    fill: rgba(0,255,0,0.2)
    ymin: 900
    ymax: 1100
    width: 2
```

### Exporting data as CSV

The raw data for the currently displayed entities and time range can be exported as a CSV file by opening the entity options and selecting Export as CSV. Note that CSV exporting does not work in the HA Companion app.

![image](https://user-images.githubusercontent.com/60828821/156686793-c0cdace6-87c0-4c1e-bb7f-58dd04035be5.png)

### Configuring the UI 

#### Header text

The default *History Explorer* header can be changed or removed using the header setting in the YAML:
```yaml
type: custom:history-explorer-card
header: 'My sample history'
header: ' '   # Using a single space will show a blank header row
header: []   # Using [] will remove the header entirely
```

#### Dark mode

The card will try to adapt its UI colors to the currently active theme. But for best results, it will have to know if you're running a dark or a light theme. By default the card asks HA for this information. If you're using the default Lovelace theme, or another modern theme that properly sets the dark mode flag, then you should be all with the default settings. If you are using an older theme that uses the legacy format and doesn't properly set the dark mode flag, the card may end up in the wrong mode. You can override the mode by adding this YAML to the global card settings (see below) to force either dark or light mode:

```yaml
type: custom:history-explorer-card
uimode: dark
```
Replace dark with light to force light mode instead.

#### Customizing the color of UI elements

The color for various elements of the UI can be customized further:

```yaml
type: custom:history-explorer-card
uiColors:
  gridlines: '#ff000040'
  labels: green
  buttons: '#80f00050'
```

#### Changing the UI layout

The position of the time control toolbar and the entity selector can be customized through YAML settings:

```yaml
type: custom:history-explorer-card
uiLayout:
  toolbar: top
  selector: bottom
```
Possible options are `top`, `bottom`, `both` and `hide`. When selecting `both`, the UI element will be duplicated and shown both on top and on the bottom. This is useful on large histories that require a lot of vertical scrolling. When `hide` is selected, the respective UI element is not shown.

The width of the label area to the left of the graphs can be customized and the labels optionally hidden with the following YAML:

```yaml
type: custom:history-explorer-card
labelsVisible: false   # this will hide the unit of measure labels and the entity names left of the graphs or timelines
labelAreaWidth: 10     # the width of the label area in pixels, default is 65
```

### Multiple cards

You can have multiple history explorer cards on the same view or over several views and dashboards. Each card has its own configuration. For the cards to be able to manage their respective configurations, each card needs its own unique name. When adding the card over the UI, a random name is assigned by default. You can adjust the name if needed. If you add the card manually over YAML, you will have to provide your own unique name for each card. 

If you only use a single history explorer card on your Lovelace, then the name is optional.

```yaml
type: custom:history-explorer-card
cardName: history-card-5
```
 
### YAML configuration for preconfigured graphs

YAML configuration is optional. And while the interactive configuration is preferrable, it can sometimes be useful to keep a set of predefined entities.

Here's a basic example configuration:

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        fill: rgba(151,187,205,0.15)
      - entity: sensor.annexe_temperature
        color: '#ee3452'
        fill: rgba(0,0,0,0)
  - type: line
    entities:
      - entity: sensor.outside_pressure
        color: '#3ecd95'
        fill: rgba(151,205,187,0.15)
  - type: timeline
    title: Non-numerical sensors
    entities:
      - entity: binary_sensor.pir_yard
        name: Yard PIR
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: input_select.qubino2_3
        name: Heater
      - entity: person.alex

```

And a more advanced one:

```yaml
type: custom:history-explorer-card
cardName: advanced-history
uimode: dark
stateColors:
  person.home: blue
  person.not_home: yellow
decimation: false
header: 'My sample history'
graphs:
  - type: line
    options:
      ymin: -10
      ymax: 30
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        fill: rgba(151,187,205,0.15)
        width: 4
        lineMode: stepped
      - entity: sensor.annexe_temperature
        color: '#ee3452'
        fill: rgba(0,0,0,0)
        lineMode: lines
  - type: line
    entities:
      - entity: sensor.outside_pressure
        color: --my-special-green
        fill: rgba(151,205,187,0.15)
  - type: timeline
    title: Non-numerical sensors
    entities:
      - entity: binary_sensor.pir_yard
        name: Yard PIR
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: input_select.qubino2_3
        name: Heater

```

Replace the entities and structure as needed.
