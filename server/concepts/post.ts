import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface PostPieceDoc extends BaseDoc {
  author: ObjectId;
  content: string;
}

export interface PostDoc extends BaseDoc {
  pieces: ObjectId[];
}

export default class PostConcept {
  public readonly posts = new DocCollection<PostDoc>("posts");
  public readonly postPieces = new DocCollection<PostPieceDoc>("postPieces");

  /**
   * Creates a single-authored post
   */
  async createSingle(author: ObjectId, content: string) {
    const _id = await this.createPiece(author, content);
    return await this.createPostFromPieces([_id]);
  }

  /**
   * Creates a post piece
   */
  async createPiece(author: ObjectId, content: string) {
    return await this.postPieces.createOne({
      author,
      content,
    });
  }

  /**
   * Creates a post using the given pieces
   */
  async createPostFromPieces(pieces: ObjectId[]) {
    const _id = await this.posts.createOne({
      pieces: pieces,
    });

    return {
      msg: "Post successfully created!",
      post: await this.posts.readOne({ _id }),
    };
  }

  /**
   * Retrieves a post by its ID
   */
  async getPostById(_id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    return post;
  }

  /**
   * Retrieves posts based on the provided query
   */
  async getPosts(query: Filter<PostDoc>) {
    const posts = await this.posts.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return posts;
  }

  /**
   * Retrieves posts by the specified author
   */
  async getByAuthor(author: ObjectId) {
    const postPieces = await this.postPieces.readMany({ author });
    return await this.getPosts({
      pieces: { $in: postPieces.map((piece) => piece._id) },
    });
  }

  /**
   * Converts pieceIds in the given posts to actual pieces
   * by fetching the corresponding post pieces
   */
  async convertPieceIdsToPieces(posts: PostDoc[]) {
    // Fetches all post pieces used in the given posts
    const postPieces = await this.postPieces.readMany({
      _id: {
        $in: posts.flatMap((post) => post.pieces),
      },
    });

    const idToPiece = new Map(postPieces.map((piece) => [piece._id.toString(), piece]));

    return posts.map((post) => ({
      ...post,
      pieces: post.pieces.map((pieceId) => idToPiece.get(pieceId.toString()) as PostPieceDoc),
    }));
  }

  /**
   * Checks if the specified user is the author of the post piece
   */
  async isAuthorOfPiece(user: ObjectId, _id: ObjectId) {
    const postPiece = await this.postPieces.readOne({ _id });
    if (!postPiece) {
      throw new NotFoundError(`Post piece ${_id} does not exist!`);
    }
    if (postPiece.author.toString() !== user.toString()) {
      throw new PostPieceAuthorNotMatchError(user, _id);
    }
  }

  /**
   * Updates the content of a post piece
   */
  async updatePiece(_id: ObjectId, content: string) {
    await this.postPieces.updateOne({ _id }, { content });
    return { msg: "Post piece successfully updated!" };
  }

  /**
   * Deletes a post piece by its ID.
   * If the piece is the only piece in its associated post, the post is also deleted.
   */
  async deletePiece(_id: ObjectId) {
    const post = await this.posts.readOne({ pieces: { $all: [new ObjectId(_id)] } });

    // Check if the post should be deleted together
    const shouldDeletePost = post?.pieces?.length === 1;

    if (shouldDeletePost) {
      await this.posts.deleteOne({ _id: post._id });
    } else if (post) {
      await this.posts.updateOne(
        { _id },
        {
          pieces: post.pieces.filter((piece) => piece.toString() !== _id.toString()),
        },
      );
    }
    await this.postPieces.deleteOne({ _id });

    return { msg: `Post piece${shouldDeletePost ? " and post" : ""} deleted successfully!` };
  }
}

export class PostPieceAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post piece {1}!", author, _id);
  }
}

export class PostAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post {1}!", author, _id);
  }
}
