import { tr } from 'i18n/runtime';
import * as yup from "yup";
const currentYear = new Date().getFullYear();

export const propertySchema = yup.object({
  // 1. basicPropertyInformation:
  propertyType: yup.string().required(tr("Property Type Is required")),
  propertyAddress: yup.string().required(tr("Property Address Is required")),
  listingPrice: yup.string().required(tr("Listing Price Is required")),
  squareFootage: yup.string().required(tr("Square Footage Is required")),
  numberofBedrooms: yup.number().required(tr("Number Of Bedrooms Is required")),
  numberofBathrooms: yup.number().required(tr("Number Of Bathrooms Is required")),
  yearBuilt: yup
    .number()
    .min(1000)
    .max(currentYear)
    .required(tr("Year Built Is required")),
  propertyDescription: yup
    .string()
    .required(tr("Property Description Is required")),
  //2. Property Features and Amenities:
  lotSize: yup.string(),
  parkingAvailability: yup.string(),
  appliancesIncluded: yup.string(),
  heatingAndCoolingSystems: yup.string(),
  flooringType: yup.string(),
  exteriorFeatures: yup.string(),
  communityAmenities: yup.string(),
  //3. Media and Visuals:
  propertyPhotos: yup.array(),
  virtualToursOrVideos: yup.array(),
  floorPlans: yup.array(),
  propertyDocuments: yup.array(),
  //4. Listing and Marketing Details:
  listingStatus: yup.string(),
  listingAgentOrTeam: yup.string(),
  listingDate: yup.string(),
  marketingDescription: yup.string(),
  multipleListingService: yup.string(),
  //5. Property History:
  previousOwners: yup.number().min(0).notRequired(),
  purchaseHistory: yup.string(),
  //6. Financial Information:
  propertyTaxes: yup.string(),
  homeownersAssociation: yup.string(),
  mortgageInformation: yup.string(),
  //7. Contacts Associated with Property:
  sellers: yup.string(),
  buyers: yup.string(),
  propertyManagers: yup.string(),
  contractorsOrServiceProviders: yup.string(),
  //8. Property Notes and Comments:
  internalNotesOrComments: yup.string(),
});
