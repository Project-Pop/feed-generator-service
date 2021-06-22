import { DocumentClient } from "aws-sdk/clients/dynamodb";
import mysql, { ConnectionOptions } from "mysql2/promise";
import {
  dynamoClient,
  FeedItem,
  followingTableName,
  GeneralPopTable,
  generateKeyForFeedFromTable,
} from "./config";

export function feedGenerator(
  connection: mysql.Connection,
  username: string,
  feedItem: FeedItem
) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const followers = await fetchFollowers(connection, username);
      await fanOutFeed(followers, feedItem);

      resolve();
    } catch (error) {
      console.log("error in feedGenerator: ", error);

      reject();
    }
  });
}

async function fetchFollowers(connection: mysql.Connection, username: string) {
  const fetchFollowersQuery = `SELECT username FROM ${followingTableName} WHERE followerUsername = ${username}`;
  const data = await connection.query(fetchFollowersQuery);
  //   TODO: do neccessary mapping here
}

async function fanOutFeed(followers: any[], item: FeedItem) {
  const promises = followers.map(async (user) => {
    var followerUsername = user.username;

    const data = await dynamoClient
      .update({
        TableName: GeneralPopTable,
        Key: generateKeyForFeedFromTable(followerUsername),
        UpdateExpression: "ADD feedItems :item",
        ExpressionAttributeValues: {
          ":item": dynamoClient.createSet([JSON.stringify(item)]), // dynamodb sets don't support non-primitive child type, eg Set<HashMaps> is not valid.
        },
        ReturnValues: "UPDATED_NEW",
      })
      .promise();

    // ! This interface is copied from internal library of DocumentClient
    interface StringSet {
      type: "String";
      values: Array<string>;
    }

    const newFeedItemSet: DocumentClient.DynamoDbSet =
      data.Attributes?.feedItems ??
      <StringSet>{
        type: "String",
        values: [],
      };

    // if no of items is greater than 300 then delete few items, may be 50, which are oldest in list
    if (newFeedItemSet.values.length > 300) {
      // since item order in dynamodb set is unreliable, so sorting it in descending order of timestamp (after mapping to FeedItem)
      // and then slicing it to get oldest 50 items
      // which are converted back to string (as dynamodb supports only primitive sets)

      const toBeDeleted = newFeedItemSet.values
        .map((item: any) => <FeedItem>JSON.parse(item))
        .sort((x, y) => y.timestamp - x.timestamp)
        .slice(250)
        .map((item) => JSON.stringify(item));

      await dynamoClient
        .update({
          TableName: GeneralPopTable,
          Key: generateKeyForFeedFromTable(followerUsername),
          UpdateExpression: "DELETE feedItems :item",
          ExpressionAttributeValues: {
            ":item": dynamoClient.createSet(toBeDeleted),
          },
        })
        .promise();
    }
  });

  await Promise.all(promises);
}
