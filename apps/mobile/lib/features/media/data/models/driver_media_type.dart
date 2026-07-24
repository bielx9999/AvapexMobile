enum DriverMediaType {
  checklist('checklists'),
  deliveryDocument('delivery-docs'),
  incident('incidents'),
  profile('profile'),
  signature('signatures');

  const DriverMediaType(this.pathSegment);

  final String pathSegment;
}
