import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { Location } from "../types";
import { NotFoundError } from "./errors";

export interface HeatMapDoc extends BaseDoc {
  item: ObjectId;
  location: Location;
  score: number;
}

const DECAY_FACTOR = 0.5 / (1000 * 60 * 60 * 24);

export default class HeatMapConcept {
  public readonly dataPoints = new DocCollection<HeatMapDoc>("heatmap");

  /**
   * Adds a data point to the HeatMap
   */
  async addDataPoint(item: ObjectId, location: Location, score: number) {
    const dataPoint = await this.dataPoints.createOne({ item, location, score });
    return { msg: "HeatMap data point created!", dataPoint: await this.dataPoints.readOne({ _id: dataPoint }) };
  }

  /**
   * Updates the score of a data point in the HeatMap
   */
  async updateScore(item: ObjectId, score: number) {
    const { matchedCount } = await this.dataPoints.updateOne({ item }, { score });
    if (!matchedCount) {
      throw new NotFoundError(`HeatMap data point for item ${item} does not exist!`);
    }
    return { msg: "HeatMap data point successfully updated!" };
  }

  /**
   * Retrieves data points from the HeatMap collection based on a query
   */
  async getDataPoints(query: Filter<HeatMapDoc>, limit?: number) {
    const dataPoints = await this.dataPoints.readMany(query, {
      sort: { dateUpdated: -1 },
      limit,
    });

    // Adjusts scores to reflect newer data more prominently
    return dataPoints.map((dataPoint) => ({
      ...dataPoint,
      score: dataPoint.score * Math.exp(-DECAY_FACTOR * (Date.now() - dataPoint.dateUpdated.getTime())),
    }));
  }
}
