## nonstop-host
Nonstop-host is a bootstrapper/service host that self-updates when new packages that match its configured parameters become available in the nonstop-index.

## Configuration
Nonstop can be used either as a library or as a command line interface.

As a command, you can configure it via a `bootstrap.json` file and environment variables. As a library, the same configuration means are available but you can also programmatically control how it is configured and when it starts.

> Note: environment variables take precendent over settings in the file.

### Bootstrap file
Defaults are shown here. The `index` property provides information necessary to contact the package index. The `package` property allows you to specify filtering information for the package. You shouldn't need to set the `architecture` or `platform` as those are detected for you. The `service` block lets you specify information for how to communicate with the service host's API as well as set failure tolerance for the hosted service. The `logging` block lets you control how standard out and file logging (via rollerpunk) get configured. By default info, warning and error levels for all nonstop-host log entries are logged to the console. `timeouts` are optional values you can change in order to determine how long nonstop will wait during a particular step before assuming something has gone very wrong so that it can re-initialize itself.

```json
{
    "index": {
      "host": "localhost",
      "api": "/api",
      "frequency": 60000,
      "port": 4444,
      "ssl": false,
      "token": ""
    },
    "package": {
      "architecture": detected,
      "branch": "",
      "build": "",
      "owner": "",
      "platform": detected,
      "project": "",
      "releaseOnly": false,
      "version": "",
      "files": "./downloads"
    },
    "service": {
      "name": sysInfo.name,
      "host": {
        "ip": "",
        "name": ""
      },
      "port": {
        "local": 9090,
        "public": 9090
      },
      "tolerance": 5000,
      "failures": 1,
      "autoRollback": true
    },
    "logging": {
      "stdOut": {
        "level": 3,
        "bailIfDebug": true,
        "topic": "#"
      },
      "rollerpunk": {
        "level": 0,
        "logFolder": "/var/log",
        "fileName": "nonstop.log",
        "maxSize": 1024,
        "maxLogFiles": 10,
        "maxUnwritten": 100,
        "maxConsecutiveReboots": 10,
        "rebootInterval": 10,
        "topic": "#"
      }
    },
    "timeouts": {
      "initializing": 15000, // 15 seconds
      "downloading": 300000, // 5 minutes
      "installing": 60000, // 1 minute
      "loading": 5000, // 5 seconds
      "prebooting": 60000, // 1 minute
      "starting": 30000, // 30 seconds
      "waiting": 60000 // 1 minute
    }
}
```

### Environment Variables
| Group | Variable | Default |
|-------|-------------|---------|
| __Index__ | | |
| | INDEX_HOST | `"localhost"` |
| | INDEX_API | `"api"` |
| | INDEX_FREQUENCY | `5000` |
| | INDEX_PORT | `4444` |
| | INDEX_SSL | `false` |
| | INDEX_TOKEN | `""` |
| __Package__ | | |
| | PACKAGE_OWNER | `` |
| | PACKAGE_PROJECT | `` |
| | PACKAGE_BRANCH | `` |
| | PACKAGE_BUILD | `` |
| | PACKAGE_VERSION | `` |
| | PACKAGE__RELEASE_ONLY | `` |
| | PACKAGE_ARCHITECTURE | detected |
| | PACKAGE_PLATFORM | detected |
| | PACKAGE_FILES | `"./downloads"` |
| __service__ | | |
| | SERVICE_NAME | `"service name"` |
| | SERVICE_HOST_NAME | `"service name"` |
| | SERVICE_HOST_IP | `"unspecified` |
| | SERVICE_PORT_LOCAL | `9090` |
| | SERVICE_PORT_PUBLIC | `9090` |
| | SERVICE_FAILURES | `1` |
| | SERVICE_TOLERANCE | `5000` |
| | SERVICE__AUTO_ROLLBACK | `true` |
| __logging__ | | |
"rollerpunk"
| | ROLLERPUNK_LEVEL | `0` |
| | ROLLERPUNK__LOG_FOLDER | `"/var/log/myapp"` |
| | ROLLERPUNK__FILE_NAME | `"whistlepunk.log"` |
| | ROLLERPUNK__MAX_SIZE | `1024` |
| | ROLLERPUNK__MAX_LOG_FILES | `10` |
| | ROLLERPUNK__MAX_UNWRITTEN | `100` |
| | ROLLERPUNK__MAX_CONSECUTIVE_REBOOTS | `10` |
| | ROLLERPUNK__REBOOT_INTERVAL | `10` |
| | ROLLERPUNK__TOPIC | `"#"` |
| __timeouts__ | | |
| | TIMEOUT_INITIALIZING | `15000` |
| | TIMEOUT_DOWNLOADING | `300000` |
| | TIMEOUT_INSTALLING | `60000` |
| | TIMEOUT_LOADING | `5000` |
| | TIMEOUT_PREBOOTING | `60000` |
| | TIMEOUT_STARTING | `30000` |
| | TIMEOUT_WAITING | `60000` |

## Boot file - boot.yaml|boot.json
nonstop expects a boot file to be contained in any package it downloads which will provide the instructions for how it should start the packaged application. The files can be written in either JSON or YAML syntax.

The boot file consists of two sections: the service boot command and an optional pre-boot command set. The boot command simply tells nonstop how to start the packaged service while the optional pre-boot command set gets fed to [drudgeon](https://github.com/LeanKit-Labs/drudgeon). Both the boot command and pre-boot commands are expressed using `drudgeon`'s command syntax since it has a flexible means of supporting command and command set variation across platforms.

> Note: these examples are super arbitrary and should not be used to infer how you would actually create steps for an actual thing.

__JSON__
```javascript
{
  "boot": "node ./src/index.js",
  "preboot": {
    "one": {
      "win32": "gulp check-windows",
      "*": "gulp check"
    },
    "two": "node prep"
  }
}
```

__YAML__
```yaml
boot: "node ./src/index.js",
preboot:
  one:
    win32: "gulp check-windows"
    *: "gulp check"
  two: "node prep"
```


