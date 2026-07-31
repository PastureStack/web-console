import Mixin from '@ember/object/mixin';


export default Mixin.create({
  queryParams: ["page", "perPage"],

  pageBinding: "content.page",

  totalPagesBinding: "content.totalPages",

  pagedContentBinding: "content"
});
