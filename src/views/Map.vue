<!-- /map -->

<template>
  <div class="map">
    <c-entry-modal v-if="showModal" @close="showModal = false" :entryId="activeEntryId" :markerOffset="markerOffset"></c-entry-modal>
    <c-sponsor-modal v-if="showSponsorModal" @close="showSponsorModal = false" :sponsoredEntry="activeSponsor"></c-sponsor-modal>
    <div class="gmaps" id="gmaps" ref="gmaps"></div>
    <div class="spot-nav clearfix" v-if="!isEmbed || showEmbedControls">
      <router-link v-if="isLoggedIn && !isEmbed" to="/add" class="spot-nav__link spot-nav__link--add"></router-link>
      <router-link v-if="!isLoggedIn && !isEmbed" to="/login" class="spot-nav__link spot-nav__link--add"></router-link>
      <a v-if="isEmbed && isLoggedIn" href="/add" target="_blank" class="spot-nav__link spot-nav__link--add"></a>
      <a v-if="isEmbed && !isLoggedIn" href="/login" target="_blank" class="spot-nav__link spot-nav__link--add"></a>
      <a href="#" @click.prevent="showUserLocation" class="spot-nav__link spot-nav__link--location" v-bind:class="{ disabled: !userCoords }"></a>
    </div>
  </div>
</template>

<script>
import EntryModal from '@/components/EntryModal';
import SponsorModal from '@/components/SponsorModal';
import mapstyle from '@/assets/gmaps.json';
import spots from '../api/spots'

// import GoogleMapsLoader from 'google-maps';
import {Loader, LoaderOptions} from 'google-maps';

export default {
  name: 'v-map',
  metaInfo: {
    title: 'Map — Bikeable'
  },
  props: [],
  components: {
    'c-sponsor-modal': SponsorModal,
    'c-entry-modal': EntryModal
  },

  computed: {
    entries() {
      return this.$store.getters.lightSpots;
    },
    sponsors() {
      return this.$store.getters.sponsoredEntries
    },
    userCoords() {
      return this.$store.getters.userCoords
    },
    isLoggedIn() {
      return this.$store.getters.isLoggedIn;
    },
    mapCenter() {
      return this.$store.getters.mapCenter;
    },
    isEmbed() {
      return this.$route.query.embed;
    },
    showEmbedControls() {
      return this.$route.query.controls;
    },
    filterByUserId() {
      return this.$route.query.user;
    },
    queryLocation() {
      if(!this.$route.query.center) return false;

      let locArray = this.$route.query.center.split(',');
      if(locArray.length != 2) return false;

      let parsedLoc = {
        lat: parseFloat(locArray[0]),
        lng: parseFloat(locArray[1])
      }

      if(isNaN(parseFloat(locArray[0])) || isNaN(parseFloat(locArray[0]))) return false;

      return parsedLoc;
    },
    queryZoom() {
      return parseInt(this.$route.query.zoom);
    }
  },

  data () {
    return {
      activeEntryId: null,
      activeSponsor: null,
      clickedCoords: null,
      showModal: false,
      showSponsorModal: false,
      markerOffset: {x:0,y:0},
      markers: [],
      filteredEntries: null,
      currentZoom: 0
    }
  },

  mounted() {
    this.$store.dispatch('getSponsoredEntries');
    this.$store.dispatch('getLightSpots');
    this.initMap();
  },

  beforeDestroy() {
    let center = {
      lat: this.map.getCenter().lat(),
      lng: this.map.getCenter().lng()
    }
    this.$store.dispatch('setMapCenter', center);
  },

  watch: {
    'entries': function() {
      this.displaySpots();
    },
    'sponsors': function() {
      this.renderSponsors();
    },
    'userCoords': function() {
      this.locateUser();
    }
  },

  methods: {

    initMap() {

      const loader = new Loader('AIzaSyD5iWyE6nsYCAhyRnL58aFFoFhAI9rcwBI', {});

      loader.load().then((google) => {
        this.google = google;

        let center = {lat: 47.377235, lng: 8.5314407};
        if(this.userCoords) center = this.userCoords;

        if(this.queryLocation) {
          center = this.queryLocation;
        }
        if(this.mapCenter) {
          center = this.mapCenter;
        }

        let zoom = 15;

        if(this.queryZoom) {
          if(this.queryZoom > 1 && this.queryZoom < 22) {
            zoom = this.queryZoom;
          }
        }

        this.currentZoom = zoom;

        this.map = new google.maps.Map(this.$refs.gmaps, {
          center: center,
          zoom: zoom,
          disableDefaultUI: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: mapstyle,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
          }
        });
        this.map.data.setStyle({
          fillColor: 'transparent',
          strokeWeight: 5,
          strokeOpacity: 0.3,
          strokeColor: "#14bdcc"
        });

        this.map.data.loadGeoJson('/static/json/regions.json');

        google.maps.event.addListener(this.map, 'zoom_changed', (e) => {
          this.setMarkerIcons();
        });

        this.displaySpots();
        this.renderSponsors();
        this.setMarkerIcons();
        this.locateUser();

      });

    },


    locateUser() {

      if(!this.userCoords || !this.google) return;

      let icon = {
        url: 'static/img/userloc.png',
        scaledSize: new this.google.maps.Size(17, 17)
      }

      var marker = new this.google.maps.Marker({
        position: this.userCoords,
        map: this.map,
        icon: icon
      });

    },

    showUserLocation() {

      if(!this.userCoords) return;

      this.map.setCenter(this.userCoords);

    },

    renderSponsors() {

      if(!this.sponsors || !this.google) return;

      this.sponsors.forEach((entry, index) => {

        if(!entry.isSponsor) return;

        let imgurl = 'static/img/star-lame.png';
        if(entry.isSponsor) imgurl = 'static/img/star.png';

        let size = 12;
        if(entry.isSponsor) size = 16;

        let icon = {
          url: imgurl,
          scaledSize: new google.maps.Size(size, size)
        }

        let marker = new this.google.maps.Marker({
          position: entry.location,
          map: this.map,
          icon: icon
        });

        marker.addListener('click', function(m) {
          this.activeSponsor = entry;
          this.showSponsorModal = true;
          // this.$router.push({ name: 'entry', params: { id: entry._id }});
        }.bind(this));

      });

    },

    setMarkerIcons() {

      if((this.currentZoom <= 14 && this.map.zoom <= 14) || (this.currentZoom > 14 && this.map.zoom > 14)) {
        this.currentZoom = this.map.zoom;
        return;
      }else{
        this.currentZoom = this.map.zoom;
      }

      let badIcon = {};
      let famedIcon = {};
      let fixedIcon = {};

      let s = new google.maps.Size(22,30);
      if(this.currentZoom > 14) {
        badIcon.scaledSize = s;
        badIcon.url = 'static/img/marker-bad.png';
        famedIcon.scaledSize = s;
        famedIcon.url = 'static/img/marker-good.png';
        fixedIcon.scaledSize = s;
        fixedIcon.url = 'static/img/marker-fixed.png';
      }else{
        s = new google.maps.Size(10, 10);
        badIcon.scaledSize = s;
        badIcon.url = 'static/img/marker-bad_s.png';
        famedIcon.scaledSize = s;
        famedIcon.url = 'static/img/marker-good_s.png';
        fixedIcon.scaledSize = s;
        fixedIcon.url = 'static/img/marker-fixed_s.png';
      }

      this.markers.forEach((marker) => {
        if(marker.famed) {
          marker.instance.setIcon(famedIcon);
        }else if(marker.fixed) {
          marker.instance.setIcon(fixedIcon);
        }else{
          marker.instance.setIcon(badIcon);
        }
      });

    },

    displaySpots() {
      if(!this.entries || !this.google) return;

      if(this.filterByUserId) {
        this.loadUserEntries()
          .then(() => {
            this.renderMarkers(this.filteredEntries);
          })
      }else{
        this.renderMarkers(this.entries);
      }
      
    },

    renderMarkers(spots) {
      spots.forEach((entry, index) => {

        let imgurl = 'static/img/marker-bad.png';

        if(entry.famed) imgurl = 'static/img/marker-good.png';
        if(entry.gotFixed) imgurl = 'static/img/marker-fixed.png';

        let icon = {
          url: imgurl,
          scaledSize: new google.maps.Size(22, 30)
        }

        let marker = new this.google.maps.Marker({
          position: entry.coords,
          map: this.map,
          icon: icon
        });

        this.markers.push({
          instance: marker,
          famed: entry.famed,
          fixed: entry.gotFixed
        });

        marker.addListener('click', function(e) {
          this.activeEntryId = entry._id;
          this.showModal = true;

          let point = this.fromLatLngToPoint(marker.getPosition(), this.map);
          this.markerOffset = this.calculateMarkerOffset(point);
          // this.$router.push({ name: 'entry', params: { id: entry._id }});
        }.bind(this));

      });

    },

    loadUserEntries() {
      let userId = this.filterByUserId;

      this.$store.commit('LOAD_START');

      return new Promise((resolve, reject) => {
        spots.getSpotsByUserId(userId)
          .then((data) => {
            this.filteredEntries = data;
            this.$store.commit('LOAD_FINISH');
            this.$emit('updateHead');
            resolve();
          },
          (error) => {
            this.$store.commit('LOAD_FINISH');
            this.$router.push('/');
            this.$store.dispatch('handleError', 'User nicht gefunden');
          });
      });

    },

    fromLatLngToPoint(latLng, map) {
      let topRight = map.getProjection().fromLatLngToPoint(map.getBounds().getNorthEast());
      var bottomLeft = map.getProjection().fromLatLngToPoint(map.getBounds().getSouthWest());

      var scale = Math.pow(2, map.getZoom());
      var worldPoint = map.getProjection().fromLatLngToPoint(latLng);
      return new google.maps.Point((worldPoint.x - bottomLeft.x) * scale, (worldPoint.y - topRight.y) * scale);
    },

    calculateMarkerOffset(point) {
      let centerX = (this.$refs.gmaps.offsetWidth / 2);
      let centerY = (this.$refs.gmaps.offsetHeight / 2);

      let offsetX = Math.round(point.x - centerX);
      let offsetY = Math.round(point.y - centerY);

      return { x: offsetX, y: offsetY };
    }

  }
}
</script>

<style lang="scss" scoped>

@import '../styles/helpers';

.map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: #fff;

  /*&::before, &::after {
    content: "";
    display: none;
    width: 100%;
    height: 3rem;
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    background-image: linear-gradient(-137deg, #FCFFD6 0%, #E2FDFF 100%);
  }*/

  .embed & {
    height: 100vh;
    top: 0;

    &::before, &::after {
      display: none;
    }
  }
  @include tablet {
    height: 100vh;

    &::before, &::after {
      height: 3rem;
    }
  }
}
.gmaps {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: calc(100% - 3rem);

  .embed & {
    height: 100%;
  }
  @include tablet {
    height: calc(100% - 3rem);
  }
}

.spot-nav {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background-color: #fafafa;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #eee;
  box-shadow: 0 4px 10px 0 rgba(#000, .1);
  border-radius: 4rem;

  &__link {
    display: block;
    width: 4rem;
    height: 4rem;
    background-color: $c-black;
    border-radius: 99%;
    color: #fff;
    text-decoration: none;
    text-align: center;
    float: left;
    position: relative;
    border: 2px solid $c-black;
    box-sizing: border-box;

    &:nth-child(2) {
      margin-left: 4px;
    }

    &:hover {
      background-color: lighten($c-black, 10%);
    }
    &.disabled {
      opacity: .2;
      pointer-events: none;
    }

    &::before {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background-size: 40px 40px;
      background-position: center;
      background-repeat: no-repeat;
    }

    &--add {
      &::before {
        background-image: url('../assets/addbutton.png');
        @include retina {
          background-image: url('../assets/addbutton@2x.png');
        }
      }
    }
    &--location {
      &::before {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background-image: url('../assets/locatebutton.png');
        background-size: 40px 40px;
        background-position: center;
        background-repeat: no-repeat;

        @include retina {
          background-image: url('../assets/locatebutton@2x.png');
        }
      }
    }
  }
}

</style>
