const { Contact } = require('../model/schema/contact');
const { Lead } = require('../model/schema/lead');
const { Property } = require('../model/schema/property');
const PartnerCustomer = require('../model/schema/partnerCustomer');

const syncOpportunity = async (opportunity) => {
  const id = opportunity._id;
  await Promise.all([
    Contact.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
    Lead.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
    Property.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
    PartnerCustomer.updateMany({ opportunities: id }, { $pull: { opportunities: id } }),
  ]);
  const updates = [];
  if (opportunity.contact) updates.push(Contact.updateOne({ _id: opportunity.contact }, { $addToSet: { relatedOpportunities: id } }));
  if (opportunity.lead) updates.push(Lead.updateOne({ _id: opportunity.lead }, { $addToSet: { relatedOpportunities: id } }));
  if (opportunity.accountName) updates.push(PartnerCustomer.updateOne({ _id: opportunity.accountName }, { $addToSet: { opportunities: id } }));
  for (const property of opportunity.properties || []) updates.push(Property.updateOne({ _id: property }, { $addToSet: { relatedOpportunities: id } }));
  await Promise.all(updates);
};

const syncLead = async (lead) => {
  const id = lead._id;
  await Promise.all([
    Contact.updateMany({ relatedLeads: id }, { $pull: { relatedLeads: id } }),
    Property.updateMany({ relatedLeads: id }, { $pull: { relatedLeads: id } }),
    PartnerCustomer.updateMany({ leads: id }, { $pull: { leads: id } }),
  ]);
  const updates = [];
  if (lead.contact) updates.push(Contact.updateOne({ _id: lead.contact }, { $addToSet: { relatedLeads: id } }));
  if (lead.associatedListing) updates.push(Property.updateOne({ _id: lead.associatedListing }, { $addToSet: { relatedLeads: id } }));
  if (lead.partnerCustomer) updates.push(PartnerCustomer.updateOne({ _id: lead.partnerCustomer }, { $addToSet: { leads: id } }));
  await Promise.all(updates);
};

const unlinkOpportunity = async (id) => Promise.all([
  Contact.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
  Lead.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
  Property.updateMany({ relatedOpportunities: id }, { $pull: { relatedOpportunities: id } }),
  PartnerCustomer.updateMany({ opportunities: id }, { $pull: { opportunities: id } }),
]);

const unlinkLead = async (id) => Promise.all([
  Contact.updateMany({ relatedLeads: id }, { $pull: { relatedLeads: id } }),
  Property.updateMany({ relatedLeads: id }, { $pull: { relatedLeads: id } }),
  PartnerCustomer.updateMany({ leads: id }, { $pull: { leads: id } }),
]);

module.exports = { syncOpportunity, syncLead, unlinkOpportunity, unlinkLead };
