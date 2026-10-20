import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { clearRecordCache } from "services/recordCache";
import imageReducer from "./slices/imageSlice";
import userReducer from "./slices/localSlice";
import routeReducer from "./slices/routeSlice";
import advanceSearchSlice from "./slices/advanceSearchSlice";
import leadSlice from "./slices/leadSlice";
import propertyCustomFiledSlice from "./slices/propertyCustomFiledSlice";
import propertySlice from "./slices/propertySlice";
import contactSlice from "./slices/contactSlice";
import contactCustomFiledSlice from "./slices/contactCustomFiledSlice";
import leadCustomFiledSlice from "./slices/leadCustomFiledSlice";
import taskSlice from "./slices/taskSlice";
import meetingSlice from "./slices/meetingSlice";
import emailsSlice from "./slices/emailsSlice";
import emailTempSlice from "./slices/emailTempSlice";
import opportunitySlice from "./slices/opportunitySlice";
import moduleSlice from "./slices/moduleSlice";
import accountSlice from "./slices/accountSlice";
import quotesSlice from "./slices/quotesSlice";
import invoicesSlice from "./slices/invoicesSlice";
import opportunityProjectSlice from "./slices/opportunityprojectSlice";
import getBankSlice from "./slices/bankDetailsSlice"

const middleware = (getDefaultMiddleware) => {
  return getDefaultMiddleware({
    serializableCheck: false,
  });
};

// Fetch server records afresh; persisted error responses can break every subsequent visit.
clearRecordCache();

const appReducer = combineReducers({
    modules: moduleSlice,
    images: imageReducer,
    user: userReducer,
    route: routeReducer,
    advanceSearchData: advanceSearchSlice,
    leadData: leadSlice,
    contactData: contactSlice,
    propertyCustomFiled: propertyCustomFiledSlice,
    contactCustomFiled: contactCustomFiledSlice,
    leadCustomFiled: leadCustomFiledSlice,
    propertyData: propertySlice,
    taskData: taskSlice,
    meetingData: meetingSlice,
    emailsData: emailsSlice,
    emailTempData: emailTempSlice,
    opportunityData: opportunitySlice,
    accountData: accountSlice,
    quotesData: quotesSlice,
    invoicesData: invoicesSlice,
    opportunityProjectData: opportunityProjectSlice,
    bankData: getBankSlice,
});

// Clearing the authenticated user also drops every in-memory, user-scoped cache.
const rootReducer = (state, action) =>
  appReducer(action.type === "user/clearUser" ? undefined : state, action);

export const store = configureStore({
  reducer: rootReducer,
  middleware,
});
