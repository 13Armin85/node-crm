const User = require("../../model/schema/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require('../../config/auth');
const { sendEmail } = require("../../middelwares/mail");

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const normalizePassword = (value) =>
  typeof value === "string" ? value.trim() : value;
const USER_ROLES = new Set(["admin", "user"]);
const normalizeRole = (value) => USER_ROLES.has(value) ? value : null;
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const sendAccountCreatedEmail = async (user) => {
  try {
    if (!user?.username) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
    const subject = 'Your CRM account has been created';
    const text = `Hello ${fullName},\n\nYour CRM account has been created.\nEmail: ${user.username}\n\nYou can now sign in to the CRM and start using your account.`;
    const html = `<p>Hello ${escapeHtml(fullName)},</p><p>Your CRM account has been created.</p><p><strong>Email:</strong> ${escapeHtml(user.username)}</p><p>You can now sign in to the CRM and start using your account.</p>`;
    await sendEmail(user.username, subject, text, html);
  } catch (error) {
    console.error('Account creation email failed:', error.message);
  }
};

// User Registration
const register = async (req, res) => {
  try {
    const { username, password, firstName, lastName, phoneNumber } =
      req.body;
    const role = normalizeRole(req.body.role);
    const normalizedUsername = normalizeEmail(username);
    const normalizedPassword = normalizePassword(password);
    if (!normalizedUsername || !normalizedPassword || normalizedPassword.length < 8) return res.status(400).json({ code: 'invalid' });
    if (!role) return res.status(400).json({ code: 'invalidRole', message: 'Role must be admin or user' });
    const user = await User.findOne({ username: normalizedUsername });

    if (user?.deleted) {
      await User.deleteOne({ _id: user._id });
    } else if (user) {
      return res
        .status(401)
        .json({ message: "user already exist please try another email" });
    }
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const newUser = new User({
      username: normalizedUsername,
      password: hashedPassword,
      role,
      firstName,
      lastName,
      phoneNumber,
      createdDate: new Date(),
      customFields: req.body.customFields,
    });
    await newUser.save();
    await sendAccountCreatedEmail(newUser);
    res.status(200).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const index = async (req, res) => {
  try {
    const query = { ...req.query, deleted: false };

    let user = await User.find(query).exec();

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const view = async (req, res) => {
  try {
    if (req.actor.role !== 'admin' && String(req.actor._id) !== String(req.params.id)) {
      return res.status(403).json({ code: 'forbidden' });
    }
    let user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ message: "no Data Found." });
    res.status(200).json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

let deleteData = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    const defaultUsers = String(process.env.DEFAULT_USERS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (defaultUsers.includes(user?.username)) {
      return res
        .status(400)
        .json({ message: `You don't have access to delete ${user.username}` });
    }
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.role !== "admin") {
      await User.deleteOne({ _id: userId });
      res.send({ message: "Record deleted Successfully" });
    } else {
      res.status(404).json({ message: "admin can not delete" });
    }
  } catch (error) {
    res.status(500).json({ error });
  }
};

const deleteMany = async (req, res) => {
  try {
    const userIds = req.body;
    const users = await User.find({ _id: { $in: userIds } });

    const defaultUsers = String(process.env.DEFAULT_USERS || '').split(',').map(value => value.trim()).filter(Boolean);
    const filteredUsers = users.filter(
      (user) => !defaultUsers.includes(user.username),
    );

    const nonAdmins = filteredUsers.filter(
      (user) => user.role !== "admin",
    );
    const nonAdminIds = nonAdmins.map((user) => user._id);

    if (nonAdminIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No users to delete or all users are protected." });
    }

    const deletedUsers = await User.deleteMany(
      { _id: { $in: nonAdminIds } },
    );

    res.status(200).json({ message: "done", deletedUsers });
  } catch (err) {
    res.status(404).json({ message: "error", err });
  }
};

const edit = async (req, res) => {
  try {
    let { username, firstName, lastName, phoneNumber } = req.body;
    if (req.actor.role !== 'admin' && String(req.actor._id) !== String(req.params.id)) {
      return res.status(403).json({ code: 'forbidden' });
    }
    const role = req.body.role === undefined ? undefined : normalizeRole(req.body.role);
    if (req.body.role !== undefined && !role) {
      return res.status(400).json({ code: 'invalidRole', message: 'Role must be admin or user' });
    }
    if (role && req.actor.role !== 'admin') {
      return res.status(403).json({ code: 'forbidden' });
    }
    if (String(req.actor?._id) === String(req.params.id) && role && role !== 'admin') {
      return res.status(400).json({ code: 'adminSelfDemotion', message: 'Administrators cannot change their own role' });
    }

    let result = await User.updateOne(
      { _id: req.params.id },
      {
        $set: {
          username,
          firstName,
          lastName,
          phoneNumber,
          customFields: req.body.customFields,
          ...(role ? { role } : {}),
        },
      },
    );

    res.status(200).json(result);
  } catch (err) {
    console.error("Failed to Update User:", err);
    res.status(400).json({ error: "Failed to Update User" });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = normalizeEmail(username);
    const normalizedPassword = normalizePassword(password);
    if (!normalizedUsername || !normalizedPassword) return res.status(400).json({ code: 'invalid' });
    // Find the user by username
    const user = await User.findOne({
      username: normalizedUsername,
      deleted: false,
    }).select('+password');
    if (!user) {
      res
        .status(401)
        .json({ error: "Authentication failed, invalid username" });
      return;
    }
    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(
      normalizedPassword,
      user.password,
    );
    if (!passwordMatch) {
      res
        .status(401)
        .json({ error: "Authentication failed,password does not match" });
      return;
    }
    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "1d",
    });

    const safeUser = user.toObject();
    delete safeUser.password;
    res
      .status(200)
      .setHeader("Authorization", `Bearer ${token}`)
      .json({ token: token, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
};

module.exports = {
  register,
  login,
  index,
  deleteMany,
  view,
  deleteData,
  edit,
};
