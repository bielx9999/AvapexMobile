enum DriverMediaType {
  checklist('checklists'),
  deliveryDocument('delivery-docs'),
  fuelingReceipt('fueling-receipts'),
  fuelingOdometer('fueling-odometers'),
  tripProof('trip-proofs'),
  incident('incidents'),
  profile('profile'),
  signature('signatures'),
  equipmentInspection('equipment-inspections');

  const DriverMediaType(this.pathSegment);

  final String pathSegment;
}
