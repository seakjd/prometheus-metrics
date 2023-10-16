import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import {
  Container,
  Jumbotron,
  Card,
  Form,
  Row,
  Col,
  Button
} from "react-bootstrap";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";

interface Metric {
  name: string;
  desc: string;
  value: number;
  type: string;
}

interface Metrics {
  [id: string]: Metric;
}

interface MetricsResult {
  time: number;
  metrics: Metrics;
}

const getMetrics = (responseBody: string) => {
  const lines = responseBody.split("\n");
  // console.log(lines);
  const metrics: Metrics = {};
  let desc = "";
  let type = "";
  lines.forEach((line, i) => {
    if (line.includes("# HELP")) {
      line = line.replace("# HELP ", "");
      // console.log(line);
      const idx = line.indexOf(" ");
      const name = line.substr(0, idx);
      desc = line.substr(idx + 1);
      // console.log('name: ' + name + ', desc: ' + desc);
      metrics[name] = { name, desc } as Metric;
    } else if (line.includes("# TYPE")) {
      line = line.replace("# TYPE ", "");
      // console.log(line);
      const idx = line.indexOf(" ");
      const name = line.substr(0, idx);
      type = line.substr(idx + 1);
      // console.log('name: ' + name + ', type: ' + type);
      metrics[name] = { ...metrics[name], type };
    } else if (line.length > 0) {
      const idx = line.lastIndexOf(" ");
      const name = line.substr(0, idx);
      let value = Number.parseFloat(line.substr(idx + 1));
      // if (value !== 0 && value < 1 && name.includes("usage")) {
      //   value *= 100;
      // }
      // console.log('name: ' + name + ', value: ' + value);

      if (!metrics[name]) {
        metrics[name] = {
          name,
          desc,
          type,
          value
        };
      } else {
        metrics[name] = { ...metrics[name], value };
      }
    }
  });
  // console.log(results);

  const keys = Object.keys(metrics);
  keys.forEach((key) => {
    const result = metrics[key];
    if (!result.value) {
      // console.log(result);
      const subKeys = keys.filter((k) => k.includes(key + "{"));
      if (subKeys.length > 0) {
        // console.log("key: " + key + ", subKeys: " + subKeys);
        let sum = 0;
        subKeys.forEach((sk) => {
          sum += +metrics[sk].value;
        });
        // console.log(sum);
        result.value = sum;
        // console.log(JSON.stringify(result));
      }
    }
  });

  return metrics;
};

const getMetricsResult = async (
  metricsUrl: string
): Promise<MetricsResult | null> => {
  const now = Date.now();
  try {
    const response = await fetch(metricsUrl);
    if (response.status === 200) {
      const data = await response.text();
      const metrics = getMetrics(data);
      return { time: now, metrics };
    } else {
      return { time: now, metrics: {} };
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};

const initialCount = 60;

const getZeros = () => {
  // generate an array of zeros
  const time = Date.now();
  let data = [];
  for (let i = -initialCount; i <= 0; i += 1) {
    data.push([time + i * 1000, 0]);
  }
  return data;
};

let data = getZeros();

const optionsInit = {
  title: {
    text: "Chart Title"
  },

  time: {
    useUTC: false
  },

  rangeSelector: {
    buttons: [
      {
        count: 1,
        type: "minute",
        text: "1M"
      },
      {
        count: 5,
        type: "minute",
        text: "5M"
      },
      {
        count: 10,
        type: "minute",
        text: "10M"
      },
      {
        count: 15,
        type: "minute",
        text: "15M"
      },
      {
        type: "all",
        text: "All"
      }
    ],
    inputEnabled: false,
    selected: 0
  },

  exporting: {
    enabled: false
  },

  series: [
    {
      name: "Values",
      data: data
    }
  ]
};

const metricsInit: string[] = [];

export const App = () => {
  const [formData, setFormData] = useState({
    metricsUrl: "https://loopback-api-app.herokuapp.com/metrics",
    scanInterval: 5
  });
  const [metricsUrl, setMetricsUrl] = useState(formData.metricsUrl);
  const [scanInterval, setScanInterval] = useState(1);
  const [metrics, setMetrics] = useState(metricsInit);
  const [metric, setMetric] = useState("");
  const [chartOptions, setChartOptions] = useState(optionsInit);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [minValue, setMinValue] = useState<number | undefined>(undefined);
  const [maxValue, setMaxValue] = useState<number | undefined>(undefined);

  const updateChartOptions = (chartTitle: string, data: any) => {
    setChartOptions({
      // ...chartOptions,
      title: {
        text: chartTitle
      },
      series: [
        {
          name: "Values",
          data: data
        }
      ]
    });
  };

  const isNodeJSApp = (metrics: string[]) => {
    const matching = metrics.filter((metric) => metric.includes("nodejs_"));
    return matching.length > 0;
  };

  const isJavaApp = (metrics: string[]) => {
    const matching = metrics.filter((metric) => metric.includes("jvm_"));
    return matching.length > 0;
  };

  const refreshChart = async (clear: boolean) => {
    try {
      if (clear) {
        data = getZeros();
        const chartTitle = `<strong>${metric.toUpperCase()}</strong>`;
        updateChartOptions(chartTitle, data);
        setScanInterval(1);
        return;
      }

      if (scanInterval !== formData.scanInterval) {
        setScanInterval(formData.scanInterval);
      }
      const results = await getMetricsResult(metricsUrl);
      // console.log("results: ");
      // console.log(results);
      if (results) {
        const keys = Object.keys(results.metrics);
        setMetrics(keys);
        let key;
        if (!metric) {
          if (isNodeJSApp(keys)) {
            key = "process_resident_memory_bytes";
          } else if (isJavaApp(keys)) {
            key = "jvm_threads_daemon_threads";
          } else {
            key = keys[0];
          }
          setMetric(key);
        } else {
          key = metric;
        }

        const result = results.metrics[key];
        console.log(
          JSON.stringify({
            time: new Date(results.time).toLocaleTimeString(),
            result: result
          })
        );
        const x = results.time;
        const y = result.value | 0;
        if (data.length >= 20 * initialCount) {
          console.log("Removing " + 20 * initialCount + "items...");
          data.splice(0, initialCount);
        } else {
          if (results.time > lastUpdateTime) {
            data.push([x, y]);
          }
          setLastUpdateTime(results.time);
        }
        // console.log(
        //   "data: [x: " + x + ", y: " + y + "], length: " + data.length
        // );

        let chartTitle = `<strong>${key.toUpperCase()}</strong>`;
        if (result.desc) {
          chartTitle += `<br/>${result.desc}`;
        }
        const value = result.value;
        const minMaxValues =
          minValue && maxValue
            ? `<br/><i>(min: ${minValue}, max: ${maxValue})</i>`
            : "";
        if (value) {
          chartTitle += `<br/>[type: ${result.type}, time: ${new Date(
            results.time
          ).toLocaleTimeString()}, value: ${value}]${minMaxValues}`;

          if (!minValue || value < minValue) {
            setMinValue(value);
          }
          if (!maxValue || value > maxValue) {
            setMaxValue(value);
          }
        }

        updateChartOptions(chartTitle, data);
      }
    } catch (error) {}
  };

  useEffect(() => {
    const intervalTime = +scanInterval || 10;
    const interval = setInterval(async () => {
      try {
        refreshChart(false);
      } catch (error) {}
    }, intervalTime * 1000);
    return () => clearInterval(interval);
  });

  const getMetricsSelectOptions = () => {
    return metrics.map((metric) => {
      return <option key={metric}>{metric}</option>;
    });
  };

  const onChangeMetricsUrl = (url: string) => {
    setFormData({
      ...formData,
      metricsUrl: url
    });
  };

  const onBlurMetricsUrl = () => {
    setMetricsUrl(formData.metricsUrl);
    refreshChart(true);
  };

  const onChangeScanInterval = (seconds: number) => {
    setFormData({
      ...formData,
      scanInterval: seconds
    });
  };

  const onBlurScanInterval = () => {
    setScanInterval(formData.scanInterval);
  };

  const onChangeMetric = (metric: string) => {
    setMetric(metric);
    setMinValue(undefined);
    setMaxValue(undefined);
    refreshChart(true);
  };

  return (
    <div>
      <Container>
        <Jumbotron className="Jumbotron">
          <h1>Prometheus Metrics</h1>
          <h5>Live and Simple to use</h5>
          <br />
          <p>
            The <u>Grafana dashboards for Prometheus</u> are good for analyzing
            what has happened before. But what if you want to watch various
            Prometheus metrics at <strong>Live</strong> (current runtime) and
            that too <strong>without</strong> Grafana / Prometheus basic
            knowledge?
          </p>
          <Button
            variant="secondary"
            target="_blank"
            href="https://grafana.com/"
          >
            Grafana
          </Button>{" "}
          <Button
            variant="primary"
            target="_blank"
            href="https://prometheus.io/"
          >
            Prometheus
          </Button>{" "}
          <Button
            variant="info"
            target="_blank"
            href="https://www.linkedin.com/in/jangulaslam/"
          >
            About Me!
          </Button>{" "}
          <br />
        </Jumbotron>
        <br />

        <Card border={"warning"}>
          <Card.Body>
            <i>
              <strong>
                <u>Note:</u>{" "}
              </strong>
              This ReactJS application is hosted in CodeSandbox. Once running in
              your browser, it DOES NOT make any calls to any other
              backend-server, besides what you specify here as your backend
              server's Prometheus metrics URL. Since your metrics URL is not on
              the same domain as that of CodeSandbox, these calls may get
              blocked by your browser because of <strong>CORS</strong>{" "}
              restrictions. In these cases, your choices are to either use a
              browser extension to disable CORS or to not have CORS restrictions
              on your backend-server.
            </i>
          </Card.Body>
        </Card>
        <br />

        <Card border={"primary"}>
          <Card.Header as="h5">Server config</Card.Header>
          <Card.Body>
            <p>
              Specify your backend server's Prometheus{" "}
              <strong>Metrics URL</strong> (default set to a sample NodeJS
              (Loopback) API backend-server running at Heroku Apps cloud
              infrastructure by me and specify the{" "}
              <strong>Scan interval</strong> in seconds (default set to 5
              seconds) down below.
            </p>
            <Form>
              <Row>
                <Col sm={8}>
                  <Form.Label style={{ marginTop: "10px" }}>
                    Metrics URL:
                  </Form.Label>
                  <Form.Control
                    value={formData.metricsUrl}
                    onChange={(e) => onChangeMetricsUrl(e.target.value)}
                    onBlur={() => onBlurMetricsUrl()}
                  />
                </Col>
                <Col sm={4}>
                  <Form.Label style={{ marginTop: "10px" }}>
                    Scan interval:
                  </Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.scanInterval}
                    onChange={(e) => onChangeScanInterval(+e.target.value)}
                    onBlur={() => onBlurScanInterval()}
                  />
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
        <br />

        <Card border={"info"}>
          <Card.Header>
            <h6>Prometheus metric:</h6>
            <Form.Control
              as="select"
              value={metric}
              onChange={(e) => onChangeMetric(e.target.value)}
            >
              {getMetricsSelectOptions()}
            </Form.Control>
          </Card.Header>
          <Card.Body>
            {/* <p>
              <strong>Note:</strong> If a <strong>usage</strong> metric value is
              below 1.0, it will be multipled by 100 to assume it is a
              percentage value to display in chart below.
            </p>
            <hr /> */}
            <HighchartsReact
              highcharts={Highcharts}
              constructorType={"stockChart"}
              options={chartOptions}
            />
          </Card.Body>
        </Card>
        <br />
      </Container>
    </div>
  );
};
