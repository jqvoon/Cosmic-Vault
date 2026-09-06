import { queryBuilder } from './queryBuilder.js';
import { Users } from '../db/models/index.js';

export const findOrCreateUser = async ({ provider, providerId, email, name, avatar }) => {
  if (!email) {
    // no email, just find or create by providerId
    let user = await queryBuilder.findOne(Users, { [`${provider}Id`]: providerId });
    if (!user) {
      user = await queryBuilder.insertOne(Users, {
        [`${provider}Id`]: providerId,
        name,
        avatar
      });
    }
    return user;
  }

  // find by email
  let user = await queryBuilder.findOne(Users, { email });

  if (user) {
    // link provider to existing account if not already linked
    if (!user[`${provider}Id`]) {
      user = await queryBuilder.updateOne(Users, { email }, { [`${provider}Id`]: providerId });
    }
  } else {
    // create new user
    user = await queryBuilder.insertOne(Users, {
      [`${provider}Id`]: providerId,
      name,
      email,
      avatar
    });
  }

  return user;
};
