import {
  dbName,
  dynamoClient,
  FeedItem,
  followingTableName,
  HomeFeedTable,
  hostName,
  rdsUsername,
  signer,
} from "./config";

import mysql, { ConnectionOptions } from "mysql2";

import { feedGenerator } from "./feedGenerator";

exports.lambdaHandler = async (event: any, context: any) => {
  // TODO: add permission to lambda for using rds proxy
  const connectionConfig: ConnectionOptions = {
    host: hostName,
    user: rdsUsername,
    database: dbName,

    ssl: "Amazon RDS",
    authPlugins: {
      mysql_clear_password: () => () =>
        new Promise((resolve, reject) => {
          signer.getAuthToken({}, (err, token) => {
            if (err) reject("can not authorize");
            resolve(token);
          });
        }),
    },
  };

  const connection = mysql.createConnection(connectionConfig);

  connection.connect(function (err) {
    if (err) {
      console.log("error connecting: " + err.stack);
      return;
    }

    console.log("connected as id " + connection.threadId + "\n");
  });

  const promises: Promise<any>[] = [];

  for (var msg of event.Records) {
    console.log(msg.messageAttributes);

    try {
      const username = msg.messageAttributes.username.stringValue;
      const postId = msg.messageAttributes.postId.stringValue;
      const imageUrl = msg.messageAttributes.imageUrl.stringValue;
      const timestamp = msg.messageAttributes.timestamp.stringValue;

      const feedItem: FeedItem = {
        postId: postId,
        imageUrl: imageUrl,
        timestamp: Number.parseInt(timestamp),
      };

      promises.push(feedGenerator(connection, username, feedItem));
    } catch (error) {
      console.log("error: ", error);
    }
  }

  await Promise.all(promises);

  // closing the connection.

  return new Promise((resolve, reject) => {
    connection.end((err) => {
      if (err) return reject(err);
      const response = {
        statusCode: 200,
      };
      resolve(response);
    });
  });
};
