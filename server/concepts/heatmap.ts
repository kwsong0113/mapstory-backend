import DocCollection, { BaseDoc } from "../framework/doc";
import Locations, { Location } from "../locations";

// Hardcoded 16 regions (cities around Cambridge) for simplicity!
export type Region =
  | "Cambridge"
  | "Somerville"
  | "Boston"
  | "Brookline"
  | "Medford"
  | "Watertown"
  | "Everett"
  | "Arlington"
  | "Belmont"
  | "Chelsea"
  | "Malden"
  | "Revere"
  | "Winchester"
  | "Newton"
  | "Winthrop"
  | "Melrose";

const VALID_REGIONS = new Set([
  "Cambridge",
  "Somerville",
  "Boston",
  "Brookline",
  "Medford",
  "Watertown",
  "Everett",
  "Arlington",
  "Belmont",
  "Chelsea",
  "Malden",
  "Revere",
  "Winchester",
  "Newton",
  "Winthrop",
  "Melrose",
]);

const MAX_SCORES_LENGTH = 100;

export interface HeatMapDoc extends BaseDoc {
  region: string;
  scores: number[];
}

export default class HeatMapConcept {
  public readonly dataPoints = new DocCollection<HeatMapDoc>("heatmap");

  /**
   * Adds a new score to the heatmap data
   */
  async add(location: Location, score: number) {
    const region = await this.getValidRegion(location);
    if (!region) {
      // If the location is not supported for heatmap,
      // simply return a message indicating so.
      // not considered an error
      return { msg: "HeatMap not supported!" };
    }
    await this.dataPoints.updateOneWithOperators(
      { region },
      {
        $push: {
          scores: {
            $each: [score],
            $slice: MAX_SCORES_LENGTH,
          },
        },
      },
      { upsert: true },
    );
    return { msg: "HeatMap data added!" };
  }

  /**
   * Removes a score from the heatmap data
   */
  async remove(location: Location, score: number) {
    const region = await this.getValidRegion(location);
    if (!region) {
      return { msg: "HeatMap not supported!" };
    }
    await this.dataPoints.updateOneWithOperators(
      { region },
      {
        $pull: {
          scores: score,
        },
      },
    );
    return { msg: "HeatMap data removed!" };
  }

  /**
   * Gets a valid region based on a location.
   */
  async getValidRegion(location: Location) {
    const region = await Locations.getCity(location);
    return region && VALID_REGIONS.has(region) ? (region as Region) : undefined;
  }

  /**
   * Retrieves data from the HeatMap collection based on a query
   */
  async getDataPoints() {
    const dataPoints = await this.dataPoints.readMany({});
    return dataPoints.map((dataPoint) => ({
      ...dataPoint,
      avgScore: dataPoint.scores.length ? dataPoint.scores.reduce((acc, cur) => acc + cur) / dataPoint.scores.length : 0,
    }));
  }
}
