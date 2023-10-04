import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ContributionDoc extends BaseDoc {
  by: ObjectId;
  item: ObjectId;
}

export interface CollaborationDoc extends BaseDoc {
  waitingFor: ObjectId[];
  contributions: ObjectId[];
}

export default class CollaborationConcept {
  public readonly collaborations = new DocCollection<CollaborationDoc>("collaborations");
  public readonly contributions = new DocCollection<ContributionDoc>("contributions");

  /**
   * Creates a new collaboration
   */
  async create(members: ObjectId[]) {
    return await this.collaborations.createOne({
      waitingFor: members,
      contributions: [],
    });
  }

  /**
   * Contributes to a collaboration
   */
  async contribute(contributor: ObjectId, item: ObjectId, _id: ObjectId) {
    await this.canContribute(contributor, _id);

    const contribution = await this.contributions.createOne({ by: contributor, item });

    await this.collaborations.updateOneWithOperators(
      { _id },
      {
        $pull: { waitingFor: { $eq: contributor } },
        $push: { contributions: contribution },
      },
    );

    return { msg: "Successfully contributed!", contribution };
  }

  /**
   * Retrieves items associated with contributions
   */
  async contributionsToItems(ids: ObjectId[]) {
    const contributions = await this.contributions.readMany({ _id: { $in: ids } });
    return contributions.map((contribution) => contribution.item);
  }

  /**
   * Retrieves a collaboration by its ID
   */
  async getCollaborationById(_id: ObjectId) {
    const collaboration = await this.collaborations.readOne({ _id });
    if (!collaboration) {
      throw new NotFoundError(`Collaboration ${_id} does not exist!`);
    }
    return collaboration;
  }

  /**
   * Retrieves a collaboration by user
   */
  async getCollaborationByUser(user: ObjectId) {
    const collaboration = await this.collaborations.readOne({
      waitingFor: { $in: [user] },
    });
    if (!collaboration) {
      throw new NotFoundError(`The user is not collaborating!`);
    }
    return collaboration;
  }

  /**
   * Checks if a user can contribute to a collaboration
   */
  async canContribute(user: ObjectId, _id: ObjectId) {
    const collaboration = await this.getCollaborationById(_id);
    const contributions = await this.contributions.readMany({
      _id: { $in: collaboration.contributions },
    });

    if (contributions.some((contribution) => contribution.by === user)) {
      throw new AlreadyContributedError(user, _id);
    }
    if (collaboration.waitingFor.every((id) => id !== user)) {
      throw new CollaborationNotMemberError(user, _id);
    }
  }

  /**
   * Cleans up a collaboration
   * by deleting associated contributions and the collaboration itself
   */
  async cleanUpCollaboration(_id: ObjectId) {
    const collaboration = await this.getCollaborationById(_id);

    // Delete all contributions associated with the collaboration
    await this.contributions.deleteMany({ _id: { $in: collaboration.contributions } });

    await this.collaborations.deleteOne({ _id });
  }
}

export class CollaborationNotMemberError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the member of collaboration {1}!", user, _id);
  }
}

export class AlreadyContributedError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} already contributed to collaboration {1}!", user, _id);
  }
}
