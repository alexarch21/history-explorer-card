# History explorer card

This is a custom history card for Home Assistant. This card offers a highly interactive and configurable way to view the history of your entities in HA. The card uses asynchronous stream caching and adaptive data decimation to hide the high latency of HA's history database accesses and tries to make it into a smooth interactive experience.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

## Features

The card can contain one or multiple charts, every chart can display the history of one or multiple entities. Currently the card supports line charts for numerical entities and timeline charts for non-numerical ones. Easily slide along your entire history and zoom into your data to analyze all details. The order the charts are displayed in the history, as well as the colors used for charts and timeline states are all fully configurable. The card entities can be added and removed on the fly without changing the configuration.

![history-explorer-demo](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-explorer-demo-480.gif)

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

Check the repository README for more information about configurations and what you can do with the card !
