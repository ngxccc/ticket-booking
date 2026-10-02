import { get } from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";
import { SharedArray } from "k6/data";
import { scenario, vu } from "k6/execution";
import type { ShowsSeatsLoadFixture } from "../../shared/types";

const defaultFixture: ShowsSeatsLoadFixture = {
  targetUrl: "http://127.0.0.1:3000",
  standardShowId: "",
  imaxShowId: "",
  standardTotalSeats: 200,
  imaxTotalSeats: 500,
};

// Load fixture data into shared memory once during init context
const fixtureData = new SharedArray("shows_seats_fixtures", () => {
  const fixturePath = __ENV["FIXTURES_PATH"] ?? "./shows-seats-fixtures.json";
  try {
    const fileContent = open(fixturePath);
    return [JSON.parse(fileContent) as ShowsSeatsLoadFixture];
  } catch {
    return [defaultFixture];
  }
});

const fixture: ShowsSeatsLoadFixture = fixtureData[0] ?? defaultFixture;

// Custom Metrics
export const seatsSuccess200 = new Counter("seats_success_200");
export const seatsClientError4xx = new Counter("seats_client_error_4xx");
export const seatsServerError5xx = new Counter("seats_server_error_5xx");
export const successRate = new Rate("seats_success_rate");

export const standardHallDuration = new Trend("standard_hall_duration_ms");
export const imaxHallDuration = new Trend("imax_hall_duration_ms");

export const options = {
  discardResponseBodies: true,
  systemTags: [
    "status",
    "method",
    "url",
    "scenario",
    "check",
    "error",
    "error_code",
  ],
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    // Scenario 1: Ramping Stress Test to detect DB connection pool saturation point
    ramping_stress: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "5s", target: 25 }, // Warmup stage
        { duration: "10s", target: 100 }, // Medium concurrency
        { duration: "10s", target: 200 }, // High concurrency (saturates pg.Pool max: 20)
        { duration: "5s", target: 0 }, // Cool-down
      ],
      gracefulRampDown: "2s",
      exec: "rampingScenario",
      startTime: "0s",
    },
    // Scenario 2: Flash Crowd Burst (Sudden spike of concurrent customers opening seating chart)
    flash_crowd_burst: {
      executor: "per-vu-iterations",
      vus: 100,
      iterations: 1,
      maxDuration: "10s",
      gracefulStop: "1s",
      exec: "burstScenario",
      startTime: "32s",
    },
    // Scenario 3: Constant Throughput Test (Steady 50 RPS for 15s)
    constant_throughput: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "15s",
      preAllocatedVUs: 30,
      maxVUs: 100,
      exec: "constantRateScenario",
      startTime: "44s",
    },
  },
  thresholds: {
    // Ensure overall error rate stays within realistic expectations without total crash
    seats_server_error_5xx: ["count==0"],
    seats_success_rate: ["rate>0.95"],
    standard_hall_duration_ms: ["p(95)<1500"],
    imax_hall_duration_ms: ["p(95)<2500"],
  },
};

function executeRequest() {
  const isImax = vu.idInTest % 2 === 0;
  const showId = isImax ? fixture.imaxShowId : fixture.standardShowId;

  const url = `${fixture.targetUrl}/api/v1/shows/${showId}/seats`;
  const params = {
    headers: {
      Accept: "application/json",
      "Accept-Language": "vi",
    },
    tags: {
      scenario: scenario.name,
      hall_type: isImax ? "imax_500" : "standard_200",
    },
  };

  const response = get(url, params);

  if (response.status === 200) {
    seatsSuccess200.add(1);
    successRate.add(true);
    if (isImax) {
      imaxHallDuration.add(response.timings.duration);
    } else {
      standardHallDuration.add(response.timings.duration);
    }
  } else if (response.status >= 400 && response.status < 500) {
    seatsClientError4xx.add(1);
    successRate.add(false);
  } else {
    seatsServerError5xx.add(1);
    successRate.add(false);
  }

  check(response, {
    "status is 200 OK": (r) => r.status === 200,
    "is application/json": (r) => {
      const contentType =
        r.headers["Content-Type"] ?? r.headers["content-type"] ?? "";
      return contentType.includes("application/json");
    },
    "has content or chunked transfer": (r) => {
      const lengthHeader =
        r.headers["Content-Length"] ?? r.headers["content-length"];
      if (lengthHeader !== undefined) {
        return Number(lengthHeader) > 0;
      }
      const transferEncoding =
        r.headers["Transfer-Encoding"] ?? r.headers["transfer-encoding"] ?? "";
      return transferEncoding.includes("chunked");
    },
  });
}

/**
 * Scenario 1: Alternates between Standard (200 seats) and IMAX (500 seats) under ramping load
 */
export function rampingScenario(): void {
  executeRequest();
  sleep(0.05); // Small pacing delay
}

/**
 * Scenario 2: Flash Crowd Spike simultaneously requesting the seating layout
 */
export function burstScenario(): void {
  executeRequest();
}

/**
 * Scenario 3: Constant Arrival Rate evaluating sustained throughput stability
 */
export function constantRateScenario(): void {
  executeRequest();
}

/**
 * Output JSON summary artifact for CI and reporting
 */
export function handleSummary(data: unknown) {
  return {
    "test-results/load/shows-seats-load-summary.json": JSON.stringify(
      data,
      null,
      2,
    ),
  };
}
