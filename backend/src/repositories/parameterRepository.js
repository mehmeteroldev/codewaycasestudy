const { firestore, FieldValue } = require('../config/firebase');

const COLLECTION = 'parameters';

const toDto = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    key: data.key,
    value: data.value,
    description: data.description || '',
    countryOverrides: data.countryOverrides || {},
    version: data.version || 1,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
  };
};

const coll = () => firestore.collection(COLLECTION);

const listAll = async () => {
  const snap = await coll().orderBy('createdAt', 'desc').get();
  return snap.docs.map(toDto);
};

const findById = async (id) => {
  const doc = await coll().doc(id).get();
  return doc.exists ? toDto(doc) : null;
};

const findByKey = async (key) => {
  const snap = await coll().where('key', '==', key).limit(1).get();
  return snap.empty ? null : toDto(snap.docs[0]);
};

const create = async ({ key, value, description, countryOverrides = {} }) => {
  const ref = coll().doc();
  const payload = {
    key,
    value,
    description: description || '',
    countryOverrides,
    version: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  const created = await ref.get();
  return toDto(created);
};

// Optimistic concurrency: update only if the stored version matches `expectedVersion`.
// Throws { code: 'VERSION_MISMATCH', current } if the version has moved on.
// Throws { code: 'NOT_FOUND' } if the doc is gone.
const updateWithVersion = async (id, expectedVersion, patch) => {
  const ref = coll().doc(id);
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw { code: 'NOT_FOUND' };

    const current = snap.data();
    if ((current.version || 1) !== expectedVersion) {
      throw { code: 'VERSION_MISMATCH', current: toDto(snap) };
    }

    tx.update(ref, {
      ...patch,
      version: (current.version || 1) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { id, nextVersion: (current.version || 1) + 1 };
  });
};

const remove = async (id) => {
  await coll().doc(id).delete();
};

module.exports = {
  listAll,
  findById,
  findByKey,
  create,
  updateWithVersion,
  remove,
};
