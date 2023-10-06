import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "./errors";

/**
 * available reaction choices
 * @todo replace "a", "b" with actual reaction choices
 */
export type ReactionChoice = "heart" | "like" | "check" | "question" | "sad" | "angry";

const choiceToSentiment: Record<ReactionChoice, number> = {
  heart: 3,
  like: 2,
  check: 1,
  question: -1,
  sad: -2,
  angry: -3,
};

export interface ReactionDoc extends BaseDoc {
  by: ObjectId;
  to: ObjectId;
  choice: ReactionChoice;
}

export default class ReactionConcept {
  public readonly reactions = new DocCollection<ReactionDoc>("reactions");

  /**
   * Retrieves reactions for a specific item
   */
  async getReactions(item: ObjectId) {
    return this.reactions.readMany({ to: item });
  }

  /**
   * Adds or updates a reaction to an item
   */
  async react(to: ObjectId, by: ObjectId, choice: ReactionChoice) {
    await this.reactions.updateOne({ by, to }, { choice }, { upsert: true });

    return { msg: "reaction successful!", sentiment: await this.getAvgSentiment(to) };
  }

  /**
   * Removes a user's reaction from an item
   */
  async unreact(to: ObjectId, by: ObjectId) {
    const reaction = await this.reactions.popOne({ by, to });
    if (!reaction) {
      throw new ReactionNotFoundError(by, to);
    }

    return { msg: "reaction deleted!", sentiment: await this.getAvgSentiment(to) };
  }

  /**
   * Calculates the average sentiment value for reactions to an item
   */
  async getAvgSentiment(item: ObjectId) {
    const reactions = await this.reactions.readMany({ to: item });
    return reactions.length > 0 ? reactions.reduce((acc, cur) => acc + choiceToSentiment[cur.choice], 0) / reactions.length : undefined;
  }
}

export class ReactionNotFoundError extends NotFoundError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} did not react to {1}!", user, _id);
  }
}
