// Central export for all Mongoose models. Importing this file ensures index creation.
module.exports = {
  User: require("./User"),
  Venue: require("./Venue"),
  SubPitch: require("./SubPitch"),
  Booking: require("./Booking"),
  SlotReservation: require("./SlotReservation"),
  Payment: require("./Payment"),
  Review: require("./Review"),
  WithdrawalRequest: require("./WithdrawalRequest"),
};
