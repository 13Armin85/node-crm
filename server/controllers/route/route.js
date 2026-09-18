const customField = require('../../model/schema/customField');

const index = async (req, res) => {
    try {
        const query = req.query;
        query.deleted = false;
        let result = await customField.find({ ...query, moduleName: { $nin: ['Account', 'Accounts', 'Payments'] } });
        result.sort((a, b) => {
            return a.no - b.no;
        });

        let response = result.map((item) => ({
            _id: item._id,
            updatedDate: item.updatedDate,
            deleted: item.deleted,
            moduleName: item.moduleName,
            icon: item.icon,
            createdDate: item.createdDate
        }));

        return res.status(200).json(response);

    } catch (err) {
        console.error('Error :', err);
        return res.status(400).json({ err, error: 'Something wents wrong' });
    }
}

module.exports = { index }
