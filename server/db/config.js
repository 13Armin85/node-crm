const mongoose = require('mongoose');
const User = require('../model/schema/user');
const bcrypt = require('bcrypt');
const { initializeLeadSchema } = require("../model/schema/lead");
const { initializeContactSchema } = require("../model/schema/contact");
const { initializePropertySchema } = require("../model/schema/property");
const { createNewModule } = require("../controllers/customField/customField.js");
const { add: createNewRole } = require("../controllers/roleAccess/roleAccess.js");
const customField = require('../model/schema/customField.js');
const { contactFields } = require('./contactFields.js');
const { leadFields } = require('./leadFields.js');
const { propertiesFields } = require('./propertiesFields.js');

const initializedSchemas = async () => {
    await initializeLeadSchema();
    await initializeContactSchema();
    await initializePropertySchema();

    const CustomFields = await customField.find({ deleted: false });
    const createDynamicSchemas = async (CustomFields) => {
        for (const module of CustomFields) {
            const { moduleName, fields } = module;

            // Check if schema already exists
            if (!mongoose.models[moduleName]) {
                // Create schema object
                const schemaFields = {};
                for (const field of fields) {
                    schemaFields[field.name] = { type: field.backendType };
                    if (field.ref) schemaFields[field.name] = { type: field.backendType, ref: field.ref };
                }
                // Create Mongoose schema
                const moduleSchema = new mongoose.Schema(schemaFields);
                // Create Mongoose model
                mongoose.model(moduleName, moduleSchema, moduleName);
                console.log(`Schema created for module: ${moduleName}`);
            }
        }
    };

    await createDynamicSchemas(CustomFields);

}

const connectDB = async (DATABASE_URL, DATABASE) => {
    try {
        const DB_OPTIONS = {
            dbName: DATABASE
        }

        mongoose.set("strictQuery", false);
        await mongoose.connect(DATABASE_URL, DB_OPTIONS);

        await initializedSchemas();

        /* this was temporary  */
        const mockRes = {
            status: (code) => {
                return {
                    json: (data) => { }
                };
            },
            json: (data) => { }
        };

        // Create default modules
        await createNewModule({ body: { moduleName: 'Leads', fields: leadFields, headings: [], isDefault: true } }, mockRes);
        await createNewModule({ body: { moduleName: 'Contacts', fields: contactFields, headings: [], isDefault: true } }, mockRes);
        await createNewModule({ body: { moduleName: 'Properties', fields: propertiesFields, headings: [], isDefault: true } }, mockRes);

        // Create default role
        // await createNewRole({ body: defaultRole }, mockRes);

        /*  */
        await initializedSchemas();

        const initialAdminUsername = process.env.INITIAL_ADMIN_EMAIL;
        const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
        let adminExisting = await User.find({ role: 'superAdmin' });
        const validInitialAdmin = initialAdminUsername && initialAdminPassword && initialAdminPassword !== 'replace-with-a-strong-password';
        if (adminExisting.length <= 0 && validInitialAdmin) {
            const phoneNumber = process.env.INITIAL_ADMIN_PHONE || undefined;
            const firstName = process.env.INITIAL_ADMIN_FIRST_NAME || 'System';
            const lastName = process.env.INITIAL_ADMIN_LAST_NAME || 'Administrator';
            const username = initialAdminUsername;
            const password = initialAdminPassword;
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            // Create a new user
            const user = new User({ username, password: hashedPassword, firstName, lastName, phoneNumber, role: 'superAdmin' });
            // Save the user to the database
            await user.save();
            console.log("Admin created successfully..");
        } else if (adminExisting.length <= 0) {
            console.warn('No super administrator exists. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD for the first startup.');
        }

        console.log("Database Connected Successfully..");
    } catch (err) {
        console.error("Database not connected", err.message);
        throw err;
    }
}
module.exports = connectDB
