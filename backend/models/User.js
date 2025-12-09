// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Name is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    lastLogin: {
      type: Date,
    },
    // add other fields you need
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook - hash password if it was modified.
 * NOTE: using async function() (not arrow) so `this` refers to the document.
 * We DO NOT call next() because this is an async hook — just return / await.
 */
userSchema.pre('save', async function () {
  try {
    // only hash if password is new or modified
    if (!this.isModified('password')) return;

    const saltRounds = 10;
    const hashed = await bcrypt.hash(this.password, saltRounds);
    this.password = hashed;
  } catch (err) {
    // rethrow so mongoose treats it as an error for save()
    throw err;
  }
});

/**
 * Instance method to compare password
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Optionally hide private fields when sending JSON
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  // delete other private fields if present
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
