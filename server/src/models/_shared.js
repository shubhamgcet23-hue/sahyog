const { Schema } = require('mongoose');

/** GeoJSON Point sub-schema. coordinates default undefined so 2dsphere indexes never see an empty array. */
const pointSchema = (required = false) =>
  new Schema(
    {
      type: { type: String, enum: ['Point'], default: 'Point', required },
      coordinates: {
        type: [Number],
        default: undefined,
        required,
        validate: {
          validator: (v) => !v || (v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90),
          message: 'coordinates must be [lng, lat]',
        },
      },
    },
    { _id: false }
  );

const imageSchema = new Schema({ url: { type: String, required: true }, publicId: String }, { _id: false });

module.exports = { pointSchema, imageSchema };
