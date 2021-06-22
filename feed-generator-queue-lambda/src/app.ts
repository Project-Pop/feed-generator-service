import { dbName, FeedItem, hostName, rdsUsername, signer } from "./config";

import mysql, { ConnectionOptions } from "mysql2/promise";

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

  const connection = await mysql.createConnection(connectionConfig);

  await connection.connect();

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
  await connection.end();
};
