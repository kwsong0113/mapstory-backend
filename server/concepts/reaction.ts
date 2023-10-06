import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "./errors";

/**
 * available reaction choices
 */
export type ReactionChoice = "heart" | "like" | "check" | "question" | "sad" | "angry";

export const CHOICE_TO_SENTIMENT: Record<ReactionChoice, number> = {
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
   * Retrieves reactions for a specific item by a specific user
   */
  async getReaction(to: ObjectId, by: ObjectId) {
    return this.reactions.readOne({ to, by });
  }

  /**
   * Adds or updates a reaction to an item
   */
  async react(to: ObjectId, by: ObjectId, choice: ReactionChoice) {
    await this.reactions.updateOne({ by, to }, { choice }, { upsert: true });

    return { msg: "reaction successful!" };
  }

  /**
   * Removes a user's reaction from an item
   */
  async unreact(to: ObjectId, by: ObjectId) {
    const reaction = await this.reactions.popOne({ by, to });
    if (!reaction) {
      throw new ReactionNotFoundError(by, to);
    }

    return { msg: "reaction deleted!" };
  }

  getSentiment(choice: ReactionChoice) {
    return CHOICE_TO_SENTIMENT[choice];
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
