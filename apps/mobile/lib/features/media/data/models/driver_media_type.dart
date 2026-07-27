enum DriverMediaType {
  checklist('checklists'),
  deliveryDocument('delivery-docs'),
  fuelingReceipt('fueling-receipts'),
  fuelingOdometer('fueling-odometers'),
  incident('incidents'),
  profile('profile'),
  signature('signatures');

  const DriverMediaType(this.pathSegment);

  final String pathSegment;
}
