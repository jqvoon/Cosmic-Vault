export const queryBuilder = {
  // Get multiple documents matching a filter
  // Basic: await dbQuery.find(File, { status: 'clean' })
  // Multiple conditions: await dbQuery.find(File, { status: 'clean', userId: '123' })
  // Comparison: await dbQuery.find(File, { size: { $gt: 1000 } })
  // Sort newest first: await dbQuery.find(File, {}, { sort: { createdAt: -1 } })
  // Limit results: await dbQuery.find(File, {}, { limit: 10 })
  // Pagination: await dbQuery.find(File, {}, { skip: 10, limit: 10 })
  // Combined: await dbQuery.find(File, { status: 'clean' }, { sort: { createdAt: -1 }, limit: 20 })
  find: async (model, filter = {}, options = {}) => {
    return await model.find(filter, null, options);
  },

  // Get the first document matching a filter
  // const user = await dbQuery.findOne(User, { email: 'test@test.com' });
  // Multiple conditions: await dbQuery.findOne(User, { email: 'test@test.com', googleId: '123' })
  findOne: async (model, filter = {}) => {
    return await model.findOne(filter);
  },

  // Get a single document by its MongoDB _id
  // const file = await dbQuery.findById(File, '64abc123');
  findById: async (model, id) => {
    return await model.findById(id);
  },

  // Insert a new document
  // const user = await dbQuery.insertOne(User, { name: 'John', email: 'john@gmail.com' });
  insertOne: async (model, data) => {
    return await model.create(data);
  },

  // Insert multiple documents
  // const files = await dbQuery.insertMany(File, [{ name: 'a.txt' }, { name: 'b.txt' }]);
  insertMany: async (model, data) => {
    return await model.insertMany(data);
  },

  // Insert a new document (alias for insertOne)
  // const user = await dbQuery.create(User, { name: 'John', email: 'john@gmail.com' });
  create: async (model, data) => {
    return await model.create(data);
  },

  // Find a document by filter and update it, returns the updated document
  // const updated = await dbQuery.updateOne(File, { filename: 'test.txt' }, { status: 'clean' });
  // Multiple conditions: await dbQuery.updateOne(File, { filename: 'test.txt', userId: '123' }, { status: 'clean' })
  updateOne: async (model, filter, data) => {
    return await model.findOneAndUpdate(filter, { $set: data }, { returnDocument: "after" });
  },

  // Find a document by _id and update it, returns the updated document
  // const updated = await dbQuery.updateById(File, '64abc123', { status: 'clean' });
  updateById: async (model, id, data) => {
    return await model.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" });
  },

  // Find a document by filter and delete it
  // await dbQuery.deleteOne(File, { filename: 'test.txt' });
  // Multiple conditions: await dbQuery.deleteOne(File, { filename: 'test.txt', userId: '123' })
  deleteOne: async (model, filter) => {
    return await model.findOneAndDelete(filter);
  },

  // Find a document by _id and delete it
  // await dbQuery.deleteById(File, '64abc123');
  deleteById: async (model, id) => {
    return await model.findByIdAndDelete(id);
  },

  // Delete all documents matching a filter
  // await dbQuery.deleteMany(File, { status: 'infected' });
  // Multiple conditions: await dbQuery.deleteMany(File, { status: 'infected', userId: '123' })
  deleteMany: async (model, filter) => {
    return await model.deleteMany(filter);
  },
};
