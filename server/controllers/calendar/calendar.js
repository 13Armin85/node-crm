const Email = require('../../model/schema/email');
const PhoneCall = require('../../model/schema/phoneCall');
const Task = require('../../model/schema/task');
const MeetingHistory = require('../../model/schema/meeting');
const User = require('../../model/schema/user');
const { readScope } = require('../../services/recordAccess');

const index = async (req, res) => {
    try {
        const actor = req.actor || await User.findOne({ _id: req.user.userId, deleted: false });
        if (!actor) return res.status(401).json({ code: 'unauthorized' });
        const query = { ...req.query, deleted: false };
        const callData = await PhoneCall.find(readScope(req, actor, 'Calls', query));
        const emailData = await Email.find(readScope(req, actor, 'Emails', query));
        const meetingData = await MeetingHistory.find(readScope(req, actor, 'Meetings', query));
        const taskData = await Task.find(readScope(req, actor, 'Tasks', query));

        let taskDetails = [];
        let callDetails = [];
        let meetingDetails = [];
        let emailDetails = [];

        const mergedRoles = [];

        if (mergedRoles && mergedRoles.length > 0) {
            for (const item of mergedRoles) {
                switch (item.title) {
                    case "Calls":
                        if (item.view) {
                            callDetails = callData.map(item => ({
                                id: item._id,
                                title: item.senderName,
                                start: item.startDate,
                                backgroundColor: "green",
                                groupId: "call"
                            }));
                        }
                        break;

                    case "Emails":
                        if (item.view) {
                            emailDetails = emailData.map(item => ({
                                id: item._id,
                                title: item.subject,
                                start: item.startDate,
                                end: item.endDate,
                                backgroundColor: "blue",
                                groupId: "email"
                            }));
                        }
                        break;

                    case "Meetings":
                        if (item.view) {
                            meetingDetails = meetingData.map(item => ({
                                id: item._id,
                                title: item.agenda,
                                start: item.dateTime,
                                backgroundColor: "red",
                                groupId: "meeting"
                            }));
                        }
                        break;

                    case "Tasks":
                        if (item.view) {
                            taskDetails = taskData.map(item => ({
                                id: item._id,
                                title: item.title,
                                start: item.start,
                                end: item.end,
                                textColor: item.textColor,
                                backgroundColor: item.backgroundColor,
                                borderColor: item.borderColor,
                                url: item.url,
                                allDay: item.allDay,
                                groupId: "task"
                            }));
                        }
                        break;

                    default:
                        break;
                }
            }
        } else {
            callDetails = callData.map(item => ({
                id: item._id,
                title: item.senderName,
                start: item.startDate,
                backgroundColor: "green",
                groupId: "call"
            }));

            emailDetails = emailData.map(item => ({
                id: item._id,
                title: item.subject,
                start: item.startDate,
                end: item.endDate,
                backgroundColor: "blue",
                groupId: "email"
            }));

            meetingDetails = meetingData.map(item => ({
                id: item._id,
                title: item.agenda,
                start: item.dateTime,
                backgroundColor: "red",
                groupId: "meeting"
            }));

            taskDetails = taskData.map(item => ({
                id: item._id,
                title: item.title,
                start: item.start,
                end: item.end,
                textColor: item.textColor,
                backgroundColor: item.backgroundColor,
                borderColor: item.borderColor,
                url: item.url,
                allDay: item.allDay,
                groupId: "task"
            }));
        }

        const result = [...taskDetails, ...callDetails, ...meetingDetails, ...emailDetails];
        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
};

module.exports = { index };
