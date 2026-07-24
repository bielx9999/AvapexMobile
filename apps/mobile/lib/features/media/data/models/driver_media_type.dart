enum DriverMediaType {
  checklist('checklists'),
  deliveryDocument('delivery-docs'),
  incident('incidents'),
  signature('signatures');

  const DriverMediaType(this.pathSegment);

  final String pathSegment;
}
