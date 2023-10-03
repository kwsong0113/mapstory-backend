import { Post, User } from "./app";
import { PostAuthorNotMatchError, PostDoc, PostPieceAuthorNotMatchError } from "./concepts/post";
import { Router } from "./framework/router";

/**
 * This class does useful conversions for the frontend.
 * For example, it converts a {@link PostDoc} into a more readable format for the frontend.
 */
export default class Responses {
  /**
   * Converts a PostDoc into more readable format for the frontend
   * by converting piece IDs into pieces and the author ID into a username.
   */
  static async post(post: PostDoc | null) {
    if (!post) {
      return post;
    }

    return (await this.posts([post]))[0];
  }

  /**
   * Same as {@link post} but for an array of PostDoc.
   */
  static async posts(posts: PostDoc[]) {
    const readablePosts = await Post.convertPieceIdsToPieces(posts);
    const idToUsername = await User.idsToUsernames(readablePosts.flatMap((post) => post.pieces.map((piece) => piece.author)));

    return readablePosts.map((post) => ({
      ...post,
      pieces: post.pieces.map((piece) => ({
        ...piece,
        author: idToUsername.get(piece.author.toString()) ?? "DELETED_USER",
      })),
    }));
  }
}

Router.registerError(PostPieceAuthorNotMatchError, async (e) => {
  const username = (await User.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(PostAuthorNotMatchError, async (e) => {
  const username = (await User.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});
