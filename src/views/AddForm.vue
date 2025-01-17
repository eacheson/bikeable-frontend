<!-- /add -->

<template>
  <div class="add">
    <map-modal-view
      v-if="showMapModal"
      @close="showMapModal = false"
      @setCoords="handleMapCoords"
      :propCoords="entryCoords">
    </map-modal-view>
    <div class="container">
      <h1 v-if="!this.entryId">{{ $t('addform.addspot') }}</h1>
      <h1 v-if="this.entryId">{{ $t('editform.editspot') }} </h1>

      <form @submit.prevent="postEntry">
        <h3><span class="num">1</span>{{ $t('addform.photo') }}</h3>
        <span class="label">{{ $t('addform.uploadimage') }}</span>

        <div class="file-upload">

          <div class="file-upload__form" v-if="!uploading">
            <label for="add-file">{{ $t('addform.chooseimage')}}</label>
            <input id="add-file" @change.prevent="uploadImage" type="file">
          </div>

          <span class="file-upload__pending" v-if="uploading">{{ $t('addform.loading') }}</span>

          <div class="file-upload__images">
            <div class="file-upload__preview" v-for="image in gallery" v-bind:key="image.id">
              <a href="#" class="file-upload__preview__close" @click.prevent="resetImage(image.imageId)">×</a>
              <img v-bind:src="imagePreviewUrl(image.imageId)" @error="imageLoadError">
            </div>
          </div>


        </div>
        <div class="fameorshame">
          <h3><span class="num">2</span>{{ $t('addform.fameorshame') }}</h3>
          <div class="checkboxes">
            <input id="fame" type="radio" name="fameorshame" value="famed" v-model="entryFamed">
            <label for="fame" class="fameradio-label radio-label">
              <span>Fame</span>
            </label>
            <input id="shame" type="radio" name="fameorshame" value="shamed" v-model="entryFamed">
            <label for="shame" class="shameradio-label radio-label">
              <span>Shame</span>
            </label>
          </div>
        </div>
        <h3><span class="num">3</span>{{ $t('addform.adress') }}</h3>
        <label>
          <span>{{ $t('addform.spotwhere') }}</span>
          <input :placeholder="$t('addform.enteraddress')" type="text" v-model="entryAddress" v-bind:class="{ inactive: addressPending }" v-on:blur="checkAddress">
        </label>
        <div class="address-btns">
          <a href="#" class="address-btn address-btn--userloc" v-bind:class="{ disabled: !userCoords }" @click.prevent="handleUserCoords">{{ $t('addform.entercurrentposition') }}</a>
          <a href="#" class="address-btn address-btn--map" @click.prevent="showMapModal = true">{{ $t('addform.chooselocation') }}</a>
        </div>
        <h3><span class="num">4</span>{{ $t('addform.description') }}</h3>
        <label>
          <span>{{ $t('addform.title') }}</span>
          <input type="text" v-model="entryTitle">
        </label>
        <label>
          <span>{{ $t('addform.description') }}</span>
          <textarea v-model="entryText" rows="5"></textarea>
        </label>
        <button type="submit" class="add__btn btn" v-bind:class="{ disabled: !formReady }" :disabled="!formReady">{{ $t('addform.send') }}</button>
      </form>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import AddMapModal from '@/components/AddMapModal';
import spots from '../api/spots'

export default {
  name: 'v-add-form',
  props: ['propCoords'],
  components: {
    'map-modal-view': AddMapModal
  },
  data () {
    return {

      entryId: null,
      loadingData: true,
      currentEntry: {
        title: ' ',
        user: {
          name: ''
        },
        photo: {
          large: '',
          medium: ''
        },
        famed: false
      },

      showMapModal: false,
      addressPending: false,
      entryAddressDetails: null,
      entryAddress: '',
      entryCoords: null,
      entryTitle: '',
      entryText: '',
      entryFamed: null,
      gallery: [],
      uploading: false
    }
  },

  computed: {
    userCoords() {
      return this.$store.getters.userCoords;
    },
    formReady() {
      return (this.entryAddress != '' && this.entryTitle != '' && this.entryText != '' && this.gallery.length > 0 && this.entryFamed != null);
    }
  },

  watch: {
    'currentEntry': function() {
      this.fillForm();
    },
  },

  mounted() {
    this.handleParamCoords();

    if (this.$route.params.id) {
      this.loadEntry()
    }
  },

  methods: {
    imagePreviewUrl(imageId) {
        return process.env.BACKEND_URL + '/api/v1/photos/' + imageId + '?size=small';
    },
    loadEntry() {
      this.entryId = this.$route.params.id;
      this.$store.commit('LOAD_START');

      spots.getSpotById(this.entryId)
        .then((data) => {
          this.currentEntry = data;
          this.loadingData = false;
          this.$store.commit('LOAD_FINISH');
          this.$emit('updateHead');
        },
        (error) => {
          this.$store.commit('LOAD_FINISH');
          this.$router.push('/edit/'+this.$route.params.id);
          this.$store.dispatch('handleError', 'Spot nicht gefunden');
        });
    },

    fillForm() {

      this.entryAddress = this.currentEntry.address,
      this.entryAddressDetails = this.currentEntry.addressDetails,
      this.entryCoords = this.currentEntry.coords,
      this.entryTitle = this.currentEntry.title,
      this.entryText = this.currentEntry.text,
      this.entryFamed = this.currentEntry.famed ? "famed" : "shamed",
      this.gallery = this.currentEntry.gallery;
      this.uploading = false
    },

    imageLoadError() {
      console.log('image load error');
    },

    handleMapCoords(coords) {

      if(!coords) return;

      this.addressPending = true;

      this.getAddressDetails(coords.lat + ',' + coords.lng)
        .then((address) => {
          this.entryAddressDetails = address.details;
          this.entryAddress = address.string;
          this.entryCoords = coords;
          this.addressPending = false;
        }, (data) => {
          this.$store.dispatch('handleError', 'Fehler');
          this.addressPending = false;
        });

    },
    handleParamCoords() {

      if(!this.$route.params.coords) return;

      let pCoords = this.$route.params.coords;
      this.addressPending = true;

      this.getAddressDetails(pCoords.lat + ',' + pCoords.lng)
        .then((addressDetails) => {
          this.entryAddressDetails = address.details;
          this.entryAddress = address.string;
          this.entryCoords = pCoords;
          this.addressPending = false;
        }, (data) => {
          this.$store.dispatch('handleError', 'Fehler');
          this.addressPending = false;
        });

    },
    handleUserCoords() {
      this.addressPending = true;

      this.getAddressDetails(this.userCoords.lat + ',' + this.userCoords.lng)
        .then((address) => {
          this.entryAddressDetails = address.details;
          this.entryAddress = address.string;
          this.entryCoords = this.userCoords;
          this.addressPending = false;
        }, (data) => {
          this.$store.dispatch('handleError', 'Fehler');
          this.addressPending = false;
        });
    },
    geocodeResultToAdress(response) {

      var address = {};
      var streetnumber = "";

      response.data.results[0].address_components.forEach( (result) => {

        if (result.types.indexOf("countryCode") != -1) {
          address.countryCode = result.short_name;
        }

        if (result.types.indexOf("country") != -1) {
          address.country = result.long_name;
        }

        if (result.types.indexOf("route") != -1) {
          address.street = result.short_name;
        }

        if (result.types.indexOf("street_number") != -1) {
          streetnumber = result.long_name;
        }

        if (result.types.indexOf("postal_code") != -1) {
          address.plz = result.long_name;
        }

        if (result.types.indexOf("locality") != -1) {
          address.city = result.long_name;
        }
      });

      if (address.street) {
        address.street = address.street + " " + streetnumber;
      }

      return address;

    },
    getAddressDetails(coords) {

      return new Promise((resolve, reject) => {

        axios.get('https://maps.googleapis.com/maps/api/geocode/json?latlng='+coords+'&key=AIzaSyDSPhuEAL3Hv0zmbnhGQlTu9ax0uLXmuOE').then(response => {

          if (response.data.results[0]) {

            var address = {};
            address.details = this.geocodeResultToAdress(response);
            address.string = response.data.results[0].formatted_address;

            resolve(address);

          }else{
            reject(response);
          }
        }, response => {
          reject(esponse);
        });
      });

    },
    checkAddress() {
      this.addressPending = true;
      if(this.entryAddress == '') {
        this.clearAddress();
        return;
      }

      axios.get('https://maps.googleapis.com/maps/api/geocode/json?address=' + this.entryAddress + '&key=AIzaSyDSPhuEAL3Hv0zmbnhGQlTu9ax0uLXmuOE')
      .then(response => {

        if(response.data.results[0]) {
          this.entryAddressDetails = this.geocodeResultToAdress(response);
          this.entryAddress = response.data.results[0].formatted_address;
          this.entryCoords = response.data.results[0].geometry.location;
          this.entryAddressDetails
        } else {
          this.clearAddress();
        }
        this.addressPending = false;
      }, response => {
        this.clearAddress();
      });
    },
    clearAddress() {
      this.addressDetails = null;
      this.entryAddress = '';
      this.entryCoords = null;
      this.addressPending = false;
    },
    uploadImage(e) {
      this.uploading = true;

      let imageFile = e.currentTarget;
      let file = imageFile.files[0];
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (fileLoadEvent) => {
        this.$store.dispatch('uploadImage', {
          data: reader.result
        })
        .then((data) => {
            this.uploading = false;
            this.addImageToGallery(data.imageId);
          }, (data) => {
            this.$store.dispatch('handleError', 'Error');
            this.uploading = false;
          });
      };
    },
    addImageToGallery(imageId) {

      let userId = localStorage.getItem('userId');

      this.gallery.push({ "imageId": imageId,
          "createdAt": new Date(),
          "showsFix": false,
          "userId": userId });
    },
    resetImage(imageId) {

      this.gallery = this.gallery.filter(image => {
        return image.imageId != imageId
      });
    },
    postEntry(e) {
      if(!this.formReady) return;

      if(this.entryId) {

        this.$store.dispatch('editSpot', {data: {
            title: this.entryTitle,
            text: this.entryText,
            gallery: this.gallery,
            address: this.entryAddress,
            addressDetails: this.entryAddressDetails,
            coords: this.entryCoords,
            famed: this.entryFamed == "famed"
          }, spotId: this.entryId})
        .then((data) => {
            this.$router.push('/entries/' + data._id);
          });

      } else {

        this.$store.dispatch('addSpot', {
            title: this.entryTitle,
            text: this.entryText,
            gallery: this.gallery,
            address: this.entryAddress,
            addressDetails: this.entryAddressDetails,
            coords: this.entryCoords,
            famed: this.entryFamed == "famed"
          })
        .then((data) => {
            this.$router.push('/entries/' + data._id);
          });
      }
    }
  }
}
</script>

<style lang="scss">

@import '../styles/helpers';

.add {
  margin: 0;
  margin-top: 0;
  padding-top: 5rem;

  @include tablet {
    padding-top: 6rem;
  }

  &::before, &::after {
    content: "";
    display: block;
    width: 100%;
    height: 30rem;
    position: absolute;
    top: 0;
    left: 0;
  }
  &::before {
    z-index: -1;
    background-image: linear-gradient(0deg, #FFFFFF 2%, rgba(255,255,255,0.00) 74%);
  }
  &::after {
    z-index: -2;
    background-image: linear-gradient(-137deg, #FCFFD6 0%, #E2FDFF 100%);
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    margin-top: 2rem;

    .num {
      font-family: $f-body;
      display: inline-block;
      width: 2rem;
      height: 2rem;
      line-height: 2rem;
      font-size: 1rem;
      font-weight: 600;
      background-color: $c-black;
      color: #fff;
      text-align: center;
      margin-right: .75rem;
      border-radius: 99%;
    }

    @include tablet() {
      margin-top: 3.5rem;
      margin-bottom: 2rem;
    }
  }
  &__btn {
    display: block;
    height: 3rem;
    width: 100%;
    margin: 2rem auto 4rem auto;
    box-sizing: border-box;

    @include tablet() {
      width: 15rem;
      margin: 3rem 0 4rem 0;
    }
  }
}


.file-upload {

  &__form {

    label {
      display: block;
      color: $c-black;
      border: 2px solid $c-black;
      border-radius: 0;
      width: 14rem;
      text-align: center;
      font-weight: 500;
      height: 3rem;
      line-height: 3rem;
      cursor: pointer;
      margin-top: 1rem;
      background-color: #fafafa;
      font-size: 1rem;

      &:hover {
        border-color: $c-main;
        color: $c-main;
      }
    }
    input {
      width: 0.1px;
      height: 0.1px;
      opacity: 0;
      overflow: hidden;
      position: absolute;
      z-index: -1;
    }
  }

  &__pending {
    display: block;
    margin: 1rem 0;
  }

  &__images {
    display: flex;
    flex-wrap: wrap;

    @include tablet {
      flex-wrap: none;
    }
  }

  &__preview {
    width: 13rem;
    height: 8rem;
    background-color: $c-blue;
    padding: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    margin-right: 5px;
    margin-bottom: 5px;

    &__close {
      font-family: Arial, 'sans-serif';
      color: $c-black;
      text-decoration: none;
      position: absolute;
      top: 50%;
      right: 50%;
      width: 50px;
      height: 50px;
      margin-right: -25px;
      margin-top: -25px;
      border-radius: 99%;
      background-color: rgba(#fff, .4);
      text-align: center;
      font-size: 2rem;
      line-height: 50px;

      &:hover {
        background-color: rgba(#fff, .6);
      }
    }
    img {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      width: auto;
    }
  }
}

.fameorshame {

  .checkboxes {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  input+label {
    opacity: .6;
    transform: scale(.9);
  }

  input:checked+label {
    opacity: 1.0;
    transform: scale(1.1);

    span {
      color: $c-black;
    }

    &::before {
      transform: rotate(-10deg);
    }

    &.shameradio-label {
      &::before {
        transform: rotate(190deg);
      }
    }
  }

  input:hover+label {
    opacity: 1;
  }

  label {
    cursor: pointer;
    transition: opacity .4s $easeOutQuint, transform .4s cubic-bezier(0.175, 0.885, 0.320, 1.275);
    opacity: .4;
    position: relative;
    display: block;
    font-size: .8rem;
    margin: 0 1rem 1rem 0;
    padding-bottom: 2rem;

    &::before {
      content: "";
      display: block;
      width: 6rem;
      height: 6rem;
      background-color: $c-main;
      background-image: url('../assets/thumbs-up-white.svg');
      background-repeat: no-repeat;
      background-size: 60%;
      background-position: center;
      border-radius: 99%;
      // transform: rotate(-10deg);
      transition: .3s transform cubic-bezier(0.175, 0.885, 0.320, 1.275);
    }

    span {
      position: absolute;
      width: 100%;
      text-align: center;
      bottom: 0;
    }

  }
  .shameradio-label {
    &::before {
      background-color: $c-highlight;
      transform: rotate(180deg);
    }
  }
}


.address-btns {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 700px;
}
.address-btn {
  display: block;
  height: 2.5rem;
  font-size: .8rem;
  background-color: #fafafa;
  border: 1px solid #eee;
  padding: 0 1rem 0 3.5rem;
  color: #333;
  box-sizing: border-box;
  text-decoration: none;
  line-height: 2.5rem;
  position: relative;
  width: 100%;
  margin-bottom: 5px;
  white-space: nowrap;
  // border-radius: 4px;
  overflow: hidden;

  @include tablet() {
    width: calc(50% - 3px);
  }

  &::before {
    content: "";
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 2.5rem;
    height: 2.5rem;
    background-color: #333;
    background-size: 1.5rem 1.5rem;
    background-position: center;
    background-repeat: no-repeat;
  }
  &.disabled {
    pointer-events: none;
    color: #aaa;
    background-color: transparent;

    &::before {
      background-color: #ccc;
    }
  }
  &:hover {
    color: $c-main;
    border-color: $c-main;

    &::before {
      background-color: $c-main;
    }
  }

  &--userloc {
    &::before {
      background-image: url('../assets/locatebutton@2x.png');
    }
  }
  &--map {
    &::before {
      background-image: url('../assets/mapbutton@2x.png');
    }
  }
}

</style>
